package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.ProjectContext;
import com.coderarmy.ragsupport.model.UserMemory;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.transformers.TransformersEmbeddingModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Robust Persistent AI Memory and Project Tracking Service.
 * 
 * Features:
 * 1. Durable file-backed storage (memories.json and projects.json) surviving app restarts and page refreshes.
 * 2. Dense semantic embeddings via local all-MiniLM-L6-v2 ONNX model (384-dimensions, cosine dot product).
 * 3. Composite hybrid ranking combining semantic similarity, keyword overlap, recency decay, and importance/status weighting.
 * 4. Automatic extraction and tracking of preferences, tech stack, active projects, architectural decisions,
 *    errors with solutions, unresolved tasks, and completed task transitions.
 * 5. Strict security and anti-leak filters to reject passwords, tokens, API keys, and credentials.
 */
@Service
public class UserMemoryService {

    private static final Logger log = LoggerFactory.getLogger(UserMemoryService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, UserMemory> memoryStore = new ConcurrentHashMap<>();
    private final Map<String, ProjectContext> projectStore = new ConcurrentHashMap<>();

    private final File dataFile = new File("data/memories.json");
    private final File projectsFile = new File("data/projects.json");

    private final TransformersEmbeddingModel embeddingModel;

    @Autowired(required = false)
    private com.coderarmy.ragsupport.service.kg.KnowledgeGraphStorageService kgStorage;

    // Strict regex patterns to detect and block credentials, passwords, and API keys
    private static final Pattern SECRET_PATTERN = Pattern.compile(
            "(?i)(sk-[a-zA-Z0-9_-]{15,}|gsk_[a-zA-Z0-9_-]{15,}|pcsk_[a-zA-Z0-9_-]{15,}|AQ\\.[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9_-]{20,}|hf_[a-zA-Z0-9_-]{15,}|bearer\\s+[a-zA-Z0-9._-]{15,}|password\\s*[:=]\\s*[\"']?[^\\s\"']+|secret\\s*[:=]\\s*[\"']?[^\\s\"']+|token\\s*[:=]\\s*[\"']?[^\\s\"']+)"
    );

    private static final Set<String> STOP_WORDS = Set.of(
            "a", "an", "the", "and", "or", "is", "are", "was", "were", "to", "for", "in", "on", "with",
            "at", "by", "of", "about", "what", "how", "can", "you", "tell", "me", "i", "we", "my", "our",
            "please", "help", "do", "does", "did", "this", "that", "these", "those", "have", "has", "had"
    );

    public UserMemoryService() {
        this(null);
    }

    @Autowired
    public UserMemoryService(@Autowired(required = false) TransformersEmbeddingModel embeddingModel) {
        this.embeddingModel = embeddingModel;
        loadFromDisk();
        loadProjectsFromDisk();
    }

    @PostConstruct
    public void init() {
        backfillEmbeddings();
    }

    private synchronized void loadFromDisk() {
        try {
            if (dataFile.exists()) {
                List<UserMemory> list = objectMapper.readValue(dataFile, new TypeReference<List<UserMemory>>() {});
                for (UserMemory m : list) {
                    if (m.getId() != null && m.getContent() != null && !containsSecret(m.getContent())) {
                        memoryStore.put(m.getId(), m);
                    }
                }
                log.info("[UserMemory] Loaded {} persistent memories from {}", memoryStore.size(), dataFile.getPath());
            }
        } catch (Exception e) {
            log.warn("[UserMemory] Failed to read memories from disk: {}", e.getMessage());
        }
    }

    private synchronized void saveToDisk() {
        try {
            if (dataFile.getParentFile() != null && !dataFile.getParentFile().exists()) {
                dataFile.getParentFile().mkdirs();
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(dataFile, new ArrayList<>(memoryStore.values()));
        } catch (Exception e) {
            log.warn("[UserMemory] Failed to write memories to disk: {}", e.getMessage());
        }
    }

    private synchronized void loadProjectsFromDisk() {
        try {
            if (projectsFile.exists()) {
                List<ProjectContext> list = objectMapper.readValue(projectsFile, new TypeReference<List<ProjectContext>>() {});
                for (ProjectContext p : list) {
                    if (p.getId() != null && p.getName() != null) {
                        projectStore.put(p.getId(), p);
                    }
                }
                log.info("[UserMemory] Loaded {} project contexts from {}", projectStore.size(), projectsFile.getPath());
            }
        } catch (Exception e) {
            log.warn("[UserMemory] Failed to read projects from disk: {}", e.getMessage());
        }
    }

    private synchronized void saveProjectsToDisk() {
        try {
            if (projectsFile.getParentFile() != null && !projectsFile.getParentFile().exists()) {
                projectsFile.getParentFile().mkdirs();
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(projectsFile, new ArrayList<>(projectStore.values()));
        } catch (Exception e) {
            log.warn("[UserMemory] Failed to write projects to disk: {}", e.getMessage());
        }
    }

    /**
     * Backfills embeddings for stored memories that do not yet have vector embeddings.
     */
    public synchronized void backfillEmbeddings() {
        if (embeddingModel == null || memoryStore.isEmpty()) return;
        boolean updated = false;
        for (UserMemory m : memoryStore.values()) {
            if (m.getEmbedding() == null || m.getEmbedding().isEmpty()) {
                float[] vec = embedText(m.getContent());
                if (vec != null) {
                    m.setEmbeddingFromFloats(vec);
                    updated = true;
                }
            }
        }
        if (updated) {
            saveToDisk();
            log.info("[UserMemory] Backfilled vector embeddings for persistent memories");
        }
    }

    /**
     * Computes a dense 384-dimensional vector embedding using the local ONNX model.
     */
    public float[] embedText(String text) {
        if (embeddingModel == null || text == null || text.isBlank()) return null;
        try {
            return embeddingModel.embed(text.trim());
        } catch (Exception e) {
            log.debug("[UserMemory] Embedding generation failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Computes the cosine similarity between a float array and a Float list.
     * For L2-normalized embeddings, this equals the dot product.
     */
    public double cosineSimilarity(float[] vecA, List<Float> vecB) {
        if (vecA == null || vecB == null || vecA.length != vecB.size()) return 0.0;
        double dot = 0.0;
        double normA = 0.0;
        double normB = 0.0;
        for (int i = 0; i < vecA.length; i++) {
            float a = vecA[i];
            float b = vecB.get(i);
            dot += a * b;
            normA += a * a;
            normB += b * b;
        }
        if (normA <= 0.0 || normB <= 0.0) return 0.0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Checks if text contains sensitive secrets, tokens, or credentials.
     */
    public boolean containsSecret(String text) {
        if (text == null) return false;
        return SECRET_PATTERN.matcher(text).find();
    }

    /**
     * Retrieves all stored memories sorted by updated timestamp.
     */
    public List<UserMemory> getAllMemories() {
        return memoryStore.values().stream()
                .sorted((a, b) -> {
                    String timeA = a.getUpdatedAt() != null ? a.getUpdatedAt() : "";
                    String timeB = b.getUpdatedAt() != null ? b.getUpdatedAt() : "";
                    return timeB.compareTo(timeA);
                })
                .collect(Collectors.toList());
    }

    /**
     * Retrieves an individual memory by ID.
     */
    public Optional<UserMemory> getMemory(String id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(memoryStore.get(id));
    }

    /**
     * Adds a new memory item after validating for privacy and checking for duplicates/contradictions.
     */
    public UserMemory addMemory(String rawContent, String category, String source) {
        return addMemory(rawContent, category, source, "ACTIVE", 3, null, null);
    }

    public UserMemory addMemory(String rawContent, String category, String source, String status, int importance,
                                String conversationId, String conversationTitle) {
        if (rawContent == null || rawContent.isBlank()) {
            throw new IllegalArgumentException("Memory content cannot be blank");
        }

        if (containsSecret(rawContent)) {
            log.warn("[UserMemory] Rejected memory containing secret or credential pattern");
            throw new SecurityException("Memory cannot contain passwords, API keys, or authentication tokens");
        }

        String content = rawContent.trim();
        String cat = category != null && !category.isBlank() ? category.toUpperCase().trim() : "GENERAL";
        String stat = status != null && !status.isBlank() ? status.toUpperCase().trim() : "ACTIVE";
        int imp = Math.min(5, Math.max(1, importance));

        // Check for duplicate or conflicting existing memory
        for (UserMemory existing : memoryStore.values()) {
            if (existing.getContent().equalsIgnoreCase(content)) {
                existing.setStatus(stat);
                existing.setImportance(Math.max(existing.getImportance(), imp));
                existing.setUpdatedAt(Instant.now().toString());
                if (existing.getEmbedding() == null) {
                    existing.setEmbeddingFromFloats(embedText(content));
                }
                saveToDisk();
                return existing;
            }

            if (isContradictoryOrUpdate(existing, content, cat)) {
                existing.setContent(content);
                existing.setCategory(cat);
                existing.setStatus(stat);
                existing.setImportance(imp);
                existing.setUpdatedAt(Instant.now().toString());
                existing.setSource(source != null ? source : existing.getSource());
                existing.setEmbeddingFromFloats(embedText(content));
                saveToDisk();
                log.info("[UserMemory] Updated existing memory [id={}] with revised statement", existing.getId());
                return existing;
            }
        }

        UserMemory newMemory = new UserMemory(content, cat, source);
        newMemory.setStatus(stat);
        newMemory.setImportance(imp);
        newMemory.setConversationId(conversationId);
        newMemory.setConversationTitle(conversationTitle);
        newMemory.setEmbeddingFromFloats(embedText(content));

        memoryStore.put(newMemory.getId(), newMemory);
        saveToDisk();
        log.info("[UserMemory] Saved new persistent memory [id={}, category={}, status={}]", newMemory.getId(), cat, stat);
        return newMemory;
    }

    /**
     * Updates an existing memory.
     */
    public UserMemory updateMemory(String id, String rawContent, String category) {
        return updateMemory(id, rawContent, category, null, null);
    }

    public UserMemory updateMemory(String id, String rawContent, String category, String status, Integer importance) {
        UserMemory memory = memoryStore.get(id);
        if (memory == null) {
            throw new NoSuchElementException("Memory not found with ID: " + id);
        }

        if (rawContent != null && !rawContent.isBlank()) {
            if (containsSecret(rawContent)) {
                throw new SecurityException("Memory cannot contain passwords, API keys, or authentication tokens");
            }
            memory.setContent(rawContent.trim());
            memory.setEmbeddingFromFloats(embedText(rawContent.trim()));
        }

        if (category != null && !category.isBlank()) {
            memory.setCategory(category.toUpperCase().trim());
        }

        if (status != null && !status.isBlank()) {
            memory.setStatus(status.toUpperCase().trim());
        }

        if (importance != null) {
            memory.setImportance(Math.min(5, Math.max(1, importance)));
        }

        memory.setUpdatedAt(Instant.now().toString());
        saveToDisk();
        return memory;
    }

    /**
     * Updates status of an existing memory (e.g. mark ACTIVE -> COMPLETED / RESOLVED / SUPERSEDED).
     */
    public boolean updateMemoryStatus(String id, String newStatus) {
        UserMemory memory = memoryStore.get(id);
        if (memory != null && newStatus != null) {
            memory.setStatus(newStatus.toUpperCase().trim());
            memory.setUpdatedAt(Instant.now().toString());
            saveToDisk();
            return true;
        }
        return false;
    }

    /**
     * Deletes a specific memory item.
     */
    public boolean deleteMemory(String id) {
        if (id == null) return false;
        UserMemory removed = memoryStore.remove(id);
        if (removed != null) {
            saveToDisk();
            if (kgStorage != null) {
                try {
                    kgStorage.removeSourceFromGraph("memory", id);
                } catch (Exception ignored) {}
            }
            log.info("[UserMemory] Deleted memory [id={}]", id);
            return true;
        }
        return false;
    }

    /**
     * Clears all memories completely.
     */
    public void clearAllMemories() {
        memoryStore.clear();
        saveToDisk();
        log.info("[UserMemory] Cleared all memories");
    }

    /**
     * Retrieves relevant memories for a prompt using intelligent hybrid retrieval:
     * Dense vector semantic search (MiniLM ONNX) + keyword overlap + recency decay + importance/status weighting.
     */
    public List<UserMemory> findRelevantMemories(String prompt, int maxCount) {
        if (prompt == null || prompt.isBlank() || memoryStore.isEmpty()) {
            return Collections.emptyList();
        }

        float[] queryVec = embedText(prompt);
        Set<String> queryTokens = tokenize(prompt);
        String promptLower = prompt.toLowerCase();

        List<ScoredMemory> scored = new ArrayList<>();

        for (UserMemory mem : memoryStore.values()) {
            // 1. Semantic Similarity via Cosine Dot Product
            double cosSim = 0.0;
            if (queryVec != null && mem.getEmbedding() != null && !mem.getEmbedding().isEmpty()) {
                cosSim = Math.max(0.0, cosineSimilarity(queryVec, mem.getEmbedding()));
            }

            // 2. Keyword Overlap
            Set<String> memTokens = tokenize(mem.getContent());
            long matches = memTokens.stream().filter(queryTokens::contains).count();
            double keyScore = queryTokens.isEmpty() ? 0.0 : (double) matches / Math.max(queryTokens.size(), 4);

            // Boost keyword match for matching categories
            String cat = mem.getCategory() != null ? mem.getCategory().toUpperCase() : "GENERAL";
            if (("TECH_STACK".equals(cat) || "PREFERENCE".equals(cat)) &&
                    (promptLower.contains("code") || promptLower.contains("build") || promptLower.contains("create") || promptLower.contains("using") || promptLower.contains("stack"))) {
                keyScore += 0.20;
            }
            if ("ERROR_SOLUTION".equals(cat) && (promptLower.contains("error") || promptLower.contains("fix") || promptLower.contains("failed") || promptLower.contains("issue") || promptLower.contains("bug"))) {
                keyScore += 0.25;
            }
            if ("PROJECT".equals(cat) && (promptLower.contains("project") || promptLower.contains("app") || promptLower.contains("continue") || promptLower.contains("architecture"))) {
                keyScore += 0.25;
            }
            if ("UNRESOLVED_TASK".equals(cat) && (promptLower.contains("next") || promptLower.contains("todo") || promptLower.contains("remaining") || promptLower.contains("continue") || promptLower.contains("task"))) {
                keyScore += 0.25;
            }

            // 3. Recency Decay (exponential half-life of 14 days)
            double recScore = 1.0;
            try {
                String stamp = mem.getUpdatedAt() != null ? mem.getUpdatedAt() : mem.getCreatedAt();
                if (stamp != null) {
                    Instant updated = Instant.parse(stamp);
                    long hours = Math.max(0, ChronoUnit.HOURS.between(updated, Instant.now()));
                    recScore = Math.exp(-hours / (24.0 * 14.0));
                }
            } catch (Exception ignored) {}

            // 4. Importance Score
            double impScore = Math.min(5, Math.max(1, mem.getImportance())) / 5.0;

            // 5. Status Multiplier
            String status = mem.getStatus() != null ? mem.getStatus().toUpperCase() : "ACTIVE";
            double statusMultiplier = switch (status) {
                case "ACTIVE" -> 1.0;
                case "RESOLVED", "COMPLETED" -> 0.75;
                case "SUPERSEDED" -> 0.20;
                default -> 0.90;
            };

            // 6. Hybrid Score Synthesis
            double rawScore;
            if (queryVec != null && mem.getEmbedding() != null) {
                rawScore = (0.50 * cosSim) + (0.25 * keyScore) + (0.15 * recScore) + (0.10 * impScore);
            } else {
                rawScore = (0.65 * keyScore) + (0.20 * recScore) + (0.15 * impScore);
            }

            double finalScore = rawScore * statusMultiplier;

            // Relevance threshold: semantic similarity >= 0.30 OR keyword overlap OR composite score >= 0.20
            if (finalScore >= 0.20 || cosSim >= 0.35 || matches >= 2) {
                scored.add(new ScoredMemory(mem, finalScore));
            }
        }

        return scored.stream()
                .sorted((a, b) -> Double.compare(b.score, a.score))
                .limit(maxCount)
                .map(sm -> sm.memory)
                .collect(Collectors.toList());
    }

    /**
     * Automatically inspects user exchange to extract preferences, projects, stack requirements,
     * decisions, errors with fixes, and task completions.
     */
    public void extractAndSaveMemoriesFromExchange(String userPrompt) {
        extractAndSaveMemoriesFromExchange(null, null, userPrompt, null);
    }

    public void extractAndSaveMemoriesFromExchange(String conversationId, String conversationTitle,
                                                  String userPrompt, String assistantResponse) {
        if (userPrompt == null || userPrompt.isBlank() || containsSecret(userPrompt)) {
            return;
        }

        String promptLower = userPrompt.toLowerCase();

        // 1. Preferences: "I prefer...", "I like...", "Always use...", "Never use..."
        Pattern prefPattern = Pattern.compile("(?i)(?:i prefer|my preference is|i like|always use|never use|please always|my favorite)\\s+([^.!?\\n]{5,120})");
        Matcher prefMatcher = prefPattern.matcher(userPrompt);
        if (prefMatcher.find()) {
            String match = prefMatcher.group(1).trim();
            if (!containsSecret(match) && match.length() > 5) {
                addMemory("User preference: " + match, "PREFERENCE", "chat_extraction", "ACTIVE", 4, conversationId, conversationTitle);
            }
        }

        // 2. Tech stack: "My tech stack is...", "We are using...", "We use..."
        Pattern stackPattern = Pattern.compile("(?i)(?:my tech stack is|our tech stack is|we use|we are using|i am using|my stack includes)\\s+([^.!?\\n]{5,120})");
        Matcher stackMatcher = stackPattern.matcher(userPrompt);
        if (stackMatcher.find()) {
            String match = stackMatcher.group(1).trim();
            if (!containsSecret(match) && match.length() > 4) {
                addMemory("Tech stack: " + match, "TECH_STACK", "chat_extraction", "ACTIVE", 4, conversationId, conversationTitle);
            }
        }

        // 3. Projects: "My project is...", "I am building...", "I am working on..."
        Pattern projectPattern = Pattern.compile("(?i)(?:i am building|i am working on|my project is|our project is|i am developing)\\s+([^.!?\\n]{5,120})");
        Matcher projMatcher = projectPattern.matcher(userPrompt);
        if (projMatcher.find()) {
            String match = projMatcher.group(1).trim();
            if (!containsSecret(match) && match.length() > 5) {
                addMemory("Active project: " + match, "PROJECT", "chat_extraction", "ACTIVE", 5, conversationId, conversationTitle);
                // Also initialize or update ProjectContext
                findOrTrackProject(match, conversationTitle);
            }
        }

        // 4. Architecture & Design: "The architecture is...", "Our architecture is..."
        Pattern archPattern = Pattern.compile("(?i)(?:the architecture is|our architecture is|architecture includes|system architecture is|designed as)\\s+([^.!?\\n]{5,140})");
        Matcher archMatcher = archPattern.matcher(userPrompt);
        if (archMatcher.find()) {
            String match = archMatcher.group(1).trim();
            if (!containsSecret(match) && match.length() > 5) {
                addMemory("Architecture: " + match, "PROJECT", "chat_extraction", "ACTIVE", 4, conversationId, conversationTitle);
                if (!projectStore.isEmpty()) {
                    ProjectContext latest = projectStore.values().iterator().next();
                    latest.setArchitecture(match);
                    latest.setUpdatedAt(Instant.now().toString());
                    saveProjectsToDisk();
                }
            }
        }

        // 5. Decisions: "We decided to...", "The decision is to...", "Let's choose..."
        Pattern decisionPattern = Pattern.compile("(?i)(?:we decided to|i decided to|the decision is to|we agreed to|we chose to)\\s+([^.!?\\n]{5,140})");
        Matcher decMatcher = decisionPattern.matcher(userPrompt);
        if (decMatcher.find()) {
            String match = decMatcher.group(1).trim();
            if (!containsSecret(match) && match.length() > 5) {
                addMemory("Architectural decision: " + match, "DECISION", "chat_extraction", "ACTIVE", 4, conversationId, conversationTitle);
            }
        }

        // 6. Error & Solutions: "Error was fixed by...", "Solution was...", "Fixed the issue by..."
        Pattern errorFixPattern = Pattern.compile("(?i)(?:error was fixed by|resolved by|the solution was|fixed the (?:error|bug|issue) by|solved by|fixed by)\\s+([^.!?\\n]{5,150})");
        Matcher fixMatcher = errorFixPattern.matcher(userPrompt);
        if (fixMatcher.find()) {
            String match = fixMatcher.group(1).trim();
            if (!containsSecret(match) && match.length() > 5) {
                addMemory("Resolved issue & fix: " + match, "ERROR_SOLUTION", "chat_extraction", "RESOLVED", 3, conversationId, conversationTitle);
                if (!projectStore.isEmpty()) {
                    ProjectContext latest = projectStore.values().iterator().next();
                    if (!latest.getAttemptedSolutions().contains(match)) {
                        latest.getAttemptedSolutions().add(match);
                        latest.setUpdatedAt(Instant.now().toString());
                        saveProjectsToDisk();
                    }
                }
            }
        }

        // 7. Unresolved Tasks & Next Steps: "Next step is...", "Remaining task is...", "Still need to..."
        Pattern unresolvedPattern = Pattern.compile("(?i)(?:next step is|remaining task is|still need to|to do next|todo:\\s*|we still have to|pending task is)\\s+([^.!?\\n]{5,140})");
        Matcher unresMatcher = unresolvedPattern.matcher(userPrompt);
        if (unresMatcher.find()) {
            String match = unresMatcher.group(1).trim();
            if (!containsSecret(match) && match.length() > 5) {
                addMemory("Unresolved task: " + match, "UNRESOLVED_TASK", "chat_extraction", "ACTIVE", 4, conversationId, conversationTitle);
                recordUnresolvedTaskInActiveProject(match);
            }
        }

        // 8. Completed Tasks / Resolutions: "I have completed...", "Completed...", "Finished implementing..."
        Pattern completedPattern = Pattern.compile("(?i)(?:i (?:have )?completed(?: implementing)?|we (?:have )?completed(?: implementing)?|completed(?: implementing)?(?: the)?|finished(?: implementing)?|done with|resolved(?: the issue with)?|i (?:have )?fixed|we (?:have )?fixed)\\s+([^.!?\\n]{3,120})");
        Matcher compMatcher = completedPattern.matcher(userPrompt);
        if (compMatcher.find()) {
            String match = compMatcher.group(1).trim();
            if (!containsSecret(match) && match.length() > 3) {
                markMatchingTaskCompleted(match);
            }
        }

        // 8. Explicit memory command: "Remember that...", "Note that..."
        Pattern rememberPattern = Pattern.compile("(?i)(?:remember that|please remember|note that|keep in mind that)\\s+([^.!?\\n]{5,140})");
        Matcher remMatcher = rememberPattern.matcher(userPrompt);
        if (remMatcher.find()) {
            String match = remMatcher.group(1).trim();
            if (!containsSecret(match) && match.length() > 5) {
                addMemory("Explicit user note: " + match, "REQUIREMENT", "chat_extraction", "ACTIVE", 4, conversationId, conversationTitle);
            }
        }
    }

    private void markMatchingTaskCompleted(String completedKeyword) {
        Set<String> compTokens = tokenize(completedKeyword);
        if (compTokens.isEmpty()) return;

        for (UserMemory mem : memoryStore.values()) {
            if ("UNRESOLVED_TASK".equalsIgnoreCase(mem.getCategory()) && "ACTIVE".equalsIgnoreCase(mem.getStatus())) {
                Set<String> memTokens = tokenize(mem.getContent());
                long overlap = memTokens.stream().filter(compTokens::contains).count();
                if (overlap >= 2 || (compTokens.size() == 1 && overlap == 1)) {
                    mem.setStatus("COMPLETED");
                    mem.setUpdatedAt(Instant.now().toString());
                    saveToDisk();
                    log.info("[UserMemory] Marked task memory [id={}] as COMPLETED based on user update: '{}'", mem.getId(), completedKeyword);
                }
            }
        }

        // Also update ProjectContext if tracked
        for (ProjectContext proj : projectStore.values()) {
            List<String> unres = new ArrayList<>(proj.getUnresolvedTasks());
            for (String task : unres) {
                Set<String> taskTokens = tokenize(task);
                if (taskTokens.stream().anyMatch(compTokens::contains)) {
                    proj.getUnresolvedTasks().remove(task);
                    if (!proj.getCompletedTasks().contains(task)) {
                        proj.getCompletedTasks().add(task);
                    }
                    proj.setLastKnownState("Completed: " + completedKeyword);
                    proj.setUpdatedAt(Instant.now().toString());
                    saveProjectsToDisk();
                    break;
                }
            }
        }
    }

    private void recordUnresolvedTaskInActiveProject(String task) {
        if (projectStore.isEmpty()) return;
        // Associate with most recently updated project
        ProjectContext latest = projectStore.values().stream()
                .max(Comparator.comparing(p -> p.getUpdatedAt() != null ? p.getUpdatedAt() : ""))
                .orElse(null);
        if (latest != null && !latest.getUnresolvedTasks().contains(task)) {
            latest.getUnresolvedTasks().add(task);
            latest.setUpdatedAt(Instant.now().toString());
            saveProjectsToDisk();
        }
    }

    private void findOrTrackProject(String projectDesc, String conversationTitle) {
        String name = conversationTitle != null && !conversationTitle.isBlank() && !conversationTitle.equalsIgnoreCase("New Chat")
                ? conversationTitle
                : (projectDesc.length() > 30 ? projectDesc.substring(0, 30) + "..." : projectDesc);

        for (ProjectContext p : projectStore.values()) {
            if (p.getName().equalsIgnoreCase(name) || projectDesc.toLowerCase().contains(p.getName().toLowerCase())) {
                p.setLastKnownState(projectDesc);
                p.setUpdatedAt(Instant.now().toString());
                saveProjectsToDisk();
                return;
            }
        }

        ProjectContext newProj = new ProjectContext(name, "");
        newProj.setLastKnownState(projectDesc);
        newProj.setUpdatedAt(Instant.now().toString());
        projectStore.put(newProj.getId(), newProj);
        saveProjectsToDisk();
        log.info("[UserMemory] Tracked new ProjectContext [name={}]", name);
    }

    // --- Project Context Operations ---

    public List<ProjectContext> getAllProjects() {
        return projectStore.values().stream()
                .sorted((a, b) -> {
                    String timeA = a.getUpdatedAt() != null ? a.getUpdatedAt() : "";
                    String timeB = b.getUpdatedAt() != null ? b.getUpdatedAt() : "";
                    return timeB.compareTo(timeA);
                })
                .collect(Collectors.toList());
    }

    public Optional<ProjectContext> getProject(String id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(projectStore.get(id));
    }

    public ProjectContext saveOrUpdateProject(ProjectContext project) {
        if (project == null || project.getName() == null || project.getName().isBlank()) {
            throw new IllegalArgumentException("Project must have a valid name");
        }
        if (project.getId() == null || project.getId().isBlank()) {
            project.setId("proj-" + UUID.randomUUID().toString().substring(0, 8));
        }
        project.setUpdatedAt(Instant.now().toString());
        projectStore.put(project.getId(), project);
        saveProjectsToDisk();
        return project;
    }

    public boolean deleteProject(String id) {
        if (id == null) return false;
        boolean removed = (projectStore.remove(id) != null);
        if (removed) saveProjectsToDisk();
        return removed;
    }

    public Optional<ProjectContext> findRelevantProject(String query) {
        if (query == null || query.isBlank() || projectStore.isEmpty()) {
            return Optional.empty();
        }

        Set<String> queryTokens = tokenize(query);
        String queryLower = query.toLowerCase();

        ProjectContext bestMatch = null;
        double bestScore = 0.0;

        for (ProjectContext p : projectStore.values()) {
            double score = 0.0;
            Set<String> nameTokens = tokenize(p.getName());
            long nameMatches = nameTokens.stream().filter(queryTokens::contains).count();
            if (nameMatches > 0) {
                score += 0.5 + (0.2 * nameMatches);
            }

            if (p.getTechStack() != null) {
                Set<String> stackTokens = tokenize(p.getTechStack());
                score += 0.1 * stackTokens.stream().filter(queryTokens::contains).count();
            }

            if (p.getArchitecture() != null) {
                Set<String> archTokens = tokenize(p.getArchitecture());
                score += 0.1 * archTokens.stream().filter(queryTokens::contains).count();
            }

            if (p.getLastKnownState() != null) {
                Set<String> stateTokens = tokenize(p.getLastKnownState());
                score += 0.1 * stateTokens.stream().filter(queryTokens::contains).count();
            }

            // If prompt specifically asks for project continuation
            if (queryLower.contains("continue") || queryLower.contains("progress") || queryLower.contains("unfinished") || queryLower.contains("resume")) {
                score += 0.25;
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = p;
            }
        }

        // Return if sufficient relevance or if only one project exists and query is asking about continuing work
        if (bestScore >= 0.35 || (projectStore.size() == 1 && (queryLower.contains("continue") || queryLower.contains("project") || queryLower.contains("where we left") || queryLower.contains("resume")))) {
            return Optional.ofNullable(bestMatch != null ? bestMatch : projectStore.values().iterator().next());
        }

        return Optional.empty();
    }

    private boolean isContradictoryOrUpdate(UserMemory existing, String newContent, String category) {
        if (!existing.getCategory().equalsIgnoreCase(category)) return false;
        String eLower = existing.getContent().toLowerCase();
        String nLower = newContent.toLowerCase();

        if (eLower.contains("theme") && nLower.contains("theme")) return true;
        if ((eLower.contains("database") || eLower.contains("db")) && (nLower.contains("database") || nLower.contains("db"))) return true;
        if ((eLower.contains("language") || eLower.contains("python") || eLower.contains("java") || eLower.contains("javascript") || eLower.contains("typescript"))
                && (nLower.contains("language") || nLower.contains("python") || nLower.contains("java") || nLower.contains("javascript") || nLower.contains("typescript"))) {
            return true;
        }

        return false;
    }

    private Set<String> tokenize(String text) {
        if (text == null) return Collections.emptySet();
        String[] words = text.toLowerCase().replaceAll("[^a-z0-9\\s]", " ").split("\\s+");
        Set<String> set = new HashSet<>();
        for (String w : words) {
            if (w.length() >= 3 && !STOP_WORDS.contains(w)) {
                set.add(w);
            }
        }
        return set;
    }

    private static class ScoredMemory {
        final UserMemory memory;
        final double score;

        ScoredMemory(UserMemory memory, double score) {
            this.memory = memory;
            this.score = score;
        }
    }
}
