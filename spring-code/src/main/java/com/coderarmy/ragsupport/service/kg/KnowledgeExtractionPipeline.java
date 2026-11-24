package com.coderarmy.ragsupport.service.kg;

import com.coderarmy.ragsupport.model.Conversation;
import com.coderarmy.ragsupport.model.DocumentExtractionResult;
import com.coderarmy.ragsupport.model.ProjectContext;
import com.coderarmy.ragsupport.model.UserMemory;
import com.coderarmy.ragsupport.model.kg.KnowledgeEdge;
import com.coderarmy.ragsupport.model.kg.KnowledgeNode;
import com.coderarmy.ragsupport.model.kg.KnowledgeSourceRef;
import com.coderarmy.ragsupport.service.ConversationStorageService;
import com.coderarmy.ragsupport.service.DocumentIntelligenceService;
import com.coderarmy.ragsupport.service.UserMemoryService;
import com.coderarmy.ragsupport.service.provider.GeminiProvider;
import com.coderarmy.ragsupport.service.provider.GroqProvider;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Enterprise Knowledge Extraction & Entity Resolution Pipeline.
 *
 * Extracts structured entities and relationships from:
 * 1. User and AI conversation messages
 * 2. Persistent long-term memories
 * 3. Uploaded documents & intelligence chunks
 * 4. Multi-session project contexts & architectural decisions
 *
 * Features:
 * - Robust entity canonicalization and alias resolution
 * - Deduplication and cautious merge checks
 * - Secret and credential protection filter
 * - Idempotent incremental processing
 * - Dual-engine extraction: high-precision rule & ontology extractor + optional LLM triple extractor
 */
@Service
public class KnowledgeExtractionPipeline {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeExtractionPipeline.class);

    private final KnowledgeGraphStorageService storageService;
    private final ConversationStorageService conversationStorageService;
    private final UserMemoryService userMemoryService;
    private final DocumentIntelligenceService documentIntelligenceService;
    private final GeminiProvider geminiProvider;
    private final GroqProvider groqProvider;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ExecutorService asyncExecutor = Executors.newFixedThreadPool(2);
    private final Set<String> processedItemHashes = ConcurrentHashMap.newKeySet();

    @Value("${gemini.endpoint:https://generativelanguage.googleapis.com/v1beta/openai/chat/completions}")
    private String geminiEndpoint;

    @Value("${groq.endpoint:https://api.groq.com/openai/v1/chat/completions}")
    private String groqEndpoint;

    // Strict filter pattern for passwords, tokens, and API credentials
    private static final Pattern SECRET_PATTERN = Pattern.compile(
            "(?i)(sk-[a-zA-Z0-9_-]{15,}|gsk_[a-zA-Z0-9_-]{15,}|pcsk_[a-zA-Z0-9_-]{15,}|AQ\\.[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9_-]{20,}|hf_[a-zA-Z0-9_-]{15,}|bearer\\s+[a-zA-Z0-9._-]{15,}|password\\s*[:=]\\s*[\"']?[^\\s\"']+|secret\\s*[:=]\\s*[\"']?[^\\s\"']+|token\\s*[:=]\\s*[\"']?[^\\s\"']+)"
    );

    // Controlled Canonical Technology Dictionary & Aliases
    private static final Map<String, TechDescriptor> CANONICAL_TECH_MAP = new LinkedHashMap<>();

    private record TechDescriptor(String canonical, String category, List<String> aliases, String description) {}

    static {
        registerTech("React", "TECHNOLOGY", List.of("React.js", "ReactJS", "React framework"), "Frontend JavaScript library for declarative user interfaces.");
        registerTech("Spring Boot", "TECHNOLOGY", List.of("SpringBoot", "Spring-Boot", "Spring Boot 4"), "Java backend enterprise framework for production microservices.");
        registerTech("PostgreSQL", "TECHNOLOGY", List.of("Postgres", "PostgreSql", "PostgreSQL database"), "Open-source object-relational database management system.");
        registerTech("TypeScript", "TECHNOLOGY", List.of("TS", "TypeScript language"), "Strongly typed superset of JavaScript.");
        registerTech("Python", "TECHNOLOGY", List.of("Python 3", "Python3"), "High-level general-purpose interpreted programming language.");
        registerTech("FastAPI", "TECHNOLOGY", List.of("Fast API", "FastAPI framework"), "Modern, high-performance web framework for building APIs with Python.");
        registerTech("ClickHouse", "TECHNOLOGY", List.of("Clickhouse", "ClickHouse DB"), "High-performance columnar database for real-time analytical queries.");
        registerTech("Vite", "TECHNOLOGY", List.of("Vite.js", "ViteJS", "Vite build tool"), "Next generation frontend tooling and development server.");
        registerTech("Docker", "TECHNOLOGY", List.of("Docker container", "Docker containers"), "Platform for developing, shipping, and running applications in containers.");
        registerTech("Material UI", "TECHNOLOGY", List.of("MUI", "MUI v5", "Material-UI"), "React component library implementing Google's Material Design.");
        registerTech("Pinecone", "TECHNOLOGY", List.of("Pinecone DB", "Pinecone Vector Store", "shop-support"), "Cloud-native serverless vector database for semantic search.");
        registerTech("Google Gemini", "TECHNOLOGY", List.of("Gemini", "Gemini 2.5 Flash", "Gemini Flash"), "Google DeepMind's multimodal AI model family.");
        registerTech("Hugging Face", "ORGANIZATION", List.of("HF", "HuggingFace", "Hugging Face Hub"), "Platform and community for open-source AI models and datasets.");
        registerTech("Groq", "ORGANIZATION", List.of("Groq LPU", "GroqCloud", "Groq provider"), "High-speed LPU inference engine for large language models.");
        registerTech("Java", "TECHNOLOGY", List.of("Java 21", "Java JDK"), "Robust, class-based, object-oriented programming language.");
        registerTech("Cytoscape.js", "TECHNOLOGY", List.of("Cytoscape", "cytoscape"), "Graph theory and network visualization library for interactive analysis.");
        registerTech("ONNX Runtime", "TECHNOLOGY", List.of("ONNX", "all-MiniLM-L6-v2"), "Open Neural Network Exchange runtime for local private model inference.");
        registerTech("WebSocket", "TECHNOLOGY", List.of("WebSockets", "ws"), "Full-duplex bidirectional communication protocol over a single TCP connection.");
        registerTech("Yash AI", "PROJECT", List.of("Yash AI Platform", "YashAI"), "Full-stack multimodal AI platform with chat, vision, voice, and knowledge graph.");
        registerTech("E-Commerce Analytics Dashboard", "PROJECT", List.of("E-Commerce Dashboard", "Ecommerce Analytics"), "Real-time analytics dashboard project using React, Spring Boot, and ClickHouse.");
    }

    private static void registerTech(String canonical, String category, List<String> aliases, String description) {
        CANONICAL_TECH_MAP.put(canonical.toLowerCase(), new TechDescriptor(canonical, category, aliases, description));
    }

    @Autowired
    public KnowledgeExtractionPipeline(
            KnowledgeGraphStorageService storageService,
            ConversationStorageService conversationStorageService,
            UserMemoryService userMemoryService,
            @Autowired(required = false) DocumentIntelligenceService documentIntelligenceService,
            @Autowired(required = false) GeminiProvider geminiProvider,
            @Autowired(required = false) GroqProvider groqProvider
    ) {
        this.storageService = storageService;
        this.conversationStorageService = conversationStorageService;
        this.userMemoryService = userMemoryService;
        this.documentIntelligenceService = documentIntelligenceService;
        this.geminiProvider = geminiProvider;
        this.groqProvider = groqProvider;
    }

    @PostConstruct
    public void init() {
        // Automatically check if knowledge graph needs baseline population on startup
        asyncExecutor.submit(() -> {
            try {
                Thread.sleep(1500); // Allow services to finish startup
                if (storageService.getAllNodes().isEmpty()) {
                    log.info("[KnowledgeExtraction] Knowledge Graph is empty on startup. Executing initial knowledge baseline extraction...");
                    rebuildFromAllSources();
                } else {
                    log.info("[KnowledgeExtraction] Knowledge Graph already contains {} nodes and {} edges.",
                            storageService.getAllNodes().size(), storageService.getAllEdges().size());
                }
            } catch (Exception e) {
                log.warn("[KnowledgeExtraction] Startup extraction initialization error: {}", e.getMessage());
            }
        });
    }

    // -------------------------------------------------------------
    // Full Rebuild
    // -------------------------------------------------------------

    public synchronized Map<String, Object> rebuildFromAllSources() {
        log.info("[KnowledgeExtraction] Starting full knowledge graph rebuild from all sources...");
        long startTime = System.currentTimeMillis();

        storageService.clearAll();
        processedItemHashes.clear();

        int convCount = 0;
        int memCount = 0;
        int docCount = 0;

        // 1. Extract from persistent long-term memories
        if (userMemoryService != null) {
            List<UserMemory> memories = userMemoryService.getAllMemories();
            for (UserMemory m : memories) {
                extractFromMemory(m);
                memCount++;
            }
        }

        // 2. Extract from conversation history
        if (conversationStorageService != null) {
            List<Conversation> conversations = conversationStorageService.getAllConversations(null);
            for (Conversation conv : conversations) {
                extractFromConversation(conv);
                convCount++;
            }
        }

        // 3. Extract from indexed documents
        if (documentIntelligenceService != null) {
            List<DocumentExtractionResult> docs = documentIntelligenceService.getDocuments(null);
            for (DocumentExtractionResult doc : docs) {
                extractFromDocument(doc);
                docCount++;
            }
        }

        // 4. Extract cross-cutting concept relationships
        inferCrossCuttingConnections();

        storageService.saveToDisk();

        long durationMs = System.currentTimeMillis() - startTime;
        log.info("[KnowledgeExtraction] Full rebuild finished in {}ms. Processed {} memories, {} conversations, {} documents. Graph now has {} nodes and {} edges.",
                durationMs, memCount, convCount, docCount, storageService.getAllNodes().size(), storageService.getAllEdges().size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "success");
        result.put("durationMs", durationMs);
        result.put("totalNodes", storageService.getAllNodes().size());
        result.put("totalEdges", storageService.getAllEdges().size());
        result.put("processedConversations", convCount);
        result.put("processedMemories", memCount);
        result.put("processedDocuments", docCount);
        result.put("lastSyncTime", storageService.getLastSyncTime());
        return result;
    }

    // -------------------------------------------------------------
    // Incremental Extraction
    // -------------------------------------------------------------

    public void extractFromExchangeAsync(String conversationId, String convTitle, String userPrompt, String assistantAnswer) {
        if ((userPrompt == null || userPrompt.isBlank()) && (assistantAnswer == null || assistantAnswer.isBlank())) return;

        asyncExecutor.submit(() -> {
            try {
                extractFromExchange(conversationId, convTitle, userPrompt, assistantAnswer);
            } catch (Exception e) {
                log.warn("[KnowledgeExtraction] Async exchange extraction skipped: {}", e.getMessage());
            }
        });
    }

    public void extractFromExchange(String conversationId, String convTitle, String userPrompt, String assistantAnswer) {
        String hash = "exchange-" + conversationId + "-" + Objects.hash(userPrompt, assistantAnswer);
        if (!processedItemHashes.add(hash)) {
            return; // Already processed idempotently
        }

        String safeConvId = (conversationId != null) ? conversationId : "conv-live";
        String safeTitle = (convTitle != null && !convTitle.isBlank()) ? convTitle : "Active Chat";

        // Create or get conversation node
        KnowledgeNode convNode = getOrCreateNode(
                "conv-" + safeConvId,
                "CONVERSATION",
                safeTitle,
                "Conversation session in Yash AI: " + safeTitle,
                new KnowledgeSourceRef("conversation", safeConvId, safeTitle, "Conversation session")
        );

        String combinedText = (userPrompt != null ? userPrompt : "") + "\n" + (assistantAnswer != null ? assistantAnswer : "");
        extractEntitiesAndRelationsFromText(combinedText, safeConvId, safeTitle, "msg-exchange", convNode);
    }

    public void extractFromMemoryAsync(UserMemory memory) {
        if (memory == null) return;
        asyncExecutor.submit(() -> {
            try {
                extractFromMemory(memory);
            } catch (Exception e) {
                log.warn("[KnowledgeExtraction] Memory extraction error: {}", e.getMessage());
            }
        });
    }

    public void extractFromMemory(UserMemory memory) {
        if (memory == null || memory.getContent() == null || memory.getContent().isBlank()) return;
        if (SECRET_PATTERN.matcher(memory.getContent()).find()) {
            return; // Reject secret
        }

        String hash = "mem-" + memory.getId() + "-" + memory.getContent().hashCode();
        if (!processedItemHashes.add(hash)) {
            return;
        }

        String content = memory.getContent().trim();
        String cat = (memory.getCategory() != null) ? memory.getCategory().toUpperCase() : "GENERAL";
        String memId = memory.getId();
        String convId = memory.getConversationId();
        String convTitle = (memory.getConversationTitle() != null) ? memory.getConversationTitle() : "Persistent Memory";

        KnowledgeSourceRef sourceRef = new KnowledgeSourceRef("memory", memId, convTitle, content);
        if (convId != null) {
            sourceRef.setSourceType("conversation");
            sourceRef.setSourceId(convId);
        }

        // Project Memory
        if ("PROJECT".equalsIgnoreCase(cat) || content.toLowerCase().contains("active project") || content.toLowerCase().contains("dashboard")) {
            String projName = extractProjectName(content);
            KnowledgeNode projNode = getOrCreateNode(
                    "node-proj-" + slugify(projName),
                    "PROJECT",
                    projName,
                    content,
                    sourceRef
            );
            projNode.setStatus(memory.getStatus() != null ? memory.getStatus() : "ACTIVE");

            // Extract technologies used in project
            List<KnowledgeNode> techNodes = extractTechnologyNodes(content, sourceRef);
            for (KnowledgeNode tech : techNodes) {
                createEdge(
                        projNode.getId(),
                        tech.getId(),
                        "USES_TECHNOLOGY",
                        "Uses " + tech.getLabel(),
                        "Project uses " + tech.getLabel() + " as part of its core architecture.",
                        sourceRef,
                        1.0,
                        false
                );
            }
        }
        // Tech Stack Preference
        else if ("TECH_STACK".equalsIgnoreCase(cat) || "PREFERENCE".equalsIgnoreCase(cat)) {
            KnowledgeNode prefNode = getOrCreateNode(
                    "node-pref-" + slugify(content.substring(0, Math.min(25, content.length()))),
                    "PREFERENCE",
                    "User Preference: Tech Stack",
                    content,
                    sourceRef
            );
            prefNode.setStatus(memory.getStatus() != null ? memory.getStatus() : "ACTIVE");

            List<KnowledgeNode> techNodes = extractTechnologyNodes(content, sourceRef);
            for (KnowledgeNode tech : techNodes) {
                createEdge(
                        prefNode.getId(),
                        tech.getId(),
                        "RELATED_TO",
                        "Prefers " + tech.getLabel(),
                        "User specified preferred technology: " + tech.getLabel(),
                        sourceRef,
                        1.0,
                        false
                );
            }
        }
        // Unresolved Task
        else if ("UNRESOLVED_TASK".equalsIgnoreCase(cat) || content.toLowerCase().startsWith("unresolved task:")) {
            String taskLabel = content.replaceFirst("(?i)unresolved task:\\s*", "").trim();
            KnowledgeNode taskNode = getOrCreateNode(
                    "node-task-" + slugify(taskLabel.substring(0, Math.min(25, taskLabel.length()))),
                    "TASK",
                    taskLabel,
                    content,
                    sourceRef
            );
            taskNode.setStatus(memory.getStatus() != null ? memory.getStatus() : "UNRESOLVED");

            // Check if connected to project
            Optional<KnowledgeNode> projNode = storageService.getAllNodes().stream()
                    .filter(n -> "PROJECT".equalsIgnoreCase(n.getType()))
                    .findFirst();
            if (projNode.isPresent()) {
                createEdge(
                        projNode.get().getId(),
                        taskNode.getId(),
                        "HAS_TASK",
                        "Has Task",
                        "Project has associated task: " + taskLabel,
                        sourceRef,
                        0.9,
                        true
                );
            }
        }
        // Architectural Decision
        else if ("DECISION".equalsIgnoreCase(cat) || content.toLowerCase().contains("decision") || content.toLowerCase().contains("decided")) {
            KnowledgeNode decisionNode = getOrCreateNode(
                    "node-dec-" + slugify(content.substring(0, Math.min(25, content.length()))),
                    "DECISION",
                    "Architectural Decision",
                    content,
                    sourceRef
            );
            decisionNode.setStatus(memory.getStatus() != null ? memory.getStatus() : "VERIFIED");

            // Link to technologies mentioned
            List<KnowledgeNode> techNodes = extractTechnologyNodes(content, sourceRef);
            for (KnowledgeNode tech : techNodes) {
                createEdge(
                        decisionNode.getId(),
                        tech.getId(),
                        "USES_TECHNOLOGY",
                        "Decided Technology",
                        "Decision involves " + tech.getLabel(),
                        sourceRef,
                        1.0,
                        false
                );
            }
        } else {
            // General Concept / Fact
            List<KnowledgeNode> techNodes = extractTechnologyNodes(content, sourceRef);
            if (!techNodes.isEmpty()) {
                for (KnowledgeNode t : techNodes) {
                    t.addSource(sourceRef);
                }
            }
        }
    }

    public void extractFromConversation(Conversation conversation) {
        if (conversation == null || conversation.getMessages() == null || conversation.getMessages().isEmpty()) return;

        String convId = conversation.getId();
        String convTitle = (conversation.getTitle() != null && !conversation.getTitle().isBlank())
                ? conversation.getTitle()
                : "Conversation " + convId;

        String hash = "conv-" + convId + "-" + conversation.getMessages().size();
        if (!processedItemHashes.add(hash)) return;

        KnowledgeSourceRef convSource = new KnowledgeSourceRef("conversation", convId, convTitle, "Conversation session");

        KnowledgeNode convNode = getOrCreateNode(
                "conv-" + convId,
                "CONVERSATION",
                convTitle,
                "Conversation in Yash AI: " + convTitle,
                convSource
        );

        // Process message pairs
        for (int i = 0; i < conversation.getMessages().size(); i++) {
            Map<String, Object> msg = conversation.getMessages().get(i);
            String role = (String) msg.get("role");
            String content = (String) msg.get("content");
            String msgId = (String) msg.get("id");
            if (msgId == null) msgId = "msg-" + i;

            if (content != null && !content.isBlank() && !SECRET_PATTERN.matcher(content).find()) {
                extractEntitiesAndRelationsFromText(content, convId, convTitle, msgId, convNode);
            }
        }
    }

    public void extractFromDocumentAsync(DocumentExtractionResult document) {
        if (document == null) return;
        asyncExecutor.submit(() -> {
            try {
                extractFromDocument(document);
            } catch (Exception e) {
                log.warn("[KnowledgeExtraction] Document extraction error: {}", e.getMessage());
            }
        });
    }

    public void extractFromDocument(DocumentExtractionResult document) {
        if (document == null || document.getDocumentId() == null) return;

        String docId = document.getDocumentId();
        String fileName = document.getFileName() != null ? document.getFileName() : "Document";

        String hash = "doc-" + docId;
        if (!processedItemHashes.add(hash)) return;

        KnowledgeSourceRef docSource = new KnowledgeSourceRef("document", docId, fileName, "Document uploaded to Yash AI");

        KnowledgeNode docNode = getOrCreateNode(
                "doc-" + docId,
                "DOCUMENT",
                fileName,
                String.format("Uploaded document (%s, %d pages/sheets, %s)",
                        document.getFileType(), document.getPageCount(), document.getFormattedSize()),
                docSource
        );
        docNode.getProperties().put("fileType", document.getFileType());
        docNode.getProperties().put("pageCount", document.getPageCount());

        // Extract from text chunks
        if (document.getChunks() != null) {
            for (var chunk : document.getChunks()) {
                if (chunk.getContent() != null && !SECRET_PATTERN.matcher(chunk.getContent()).find()) {
                    KnowledgeSourceRef chunkRef = new KnowledgeSourceRef(
                            "document", docId, fileName, chunk.getPageNumber(),
                            chunk.getContent().length() > 300 ? chunk.getContent().substring(0, 300) + "..." : chunk.getContent()
                    );
                    List<KnowledgeNode> extracted = extractTechnologyNodes(chunk.getContent(), chunkRef);
                    for (KnowledgeNode ent : extracted) {
                        createEdge(
                                docNode.getId(),
                                ent.getId(),
                                "MENTIONS",
                                "Mentions",
                                "Document discusses " + ent.getLabel() + " (Page " + chunk.getPageNumber() + ")",
                                chunkRef,
                                1.0,
                                false
                        );
                    }
                }
            }
        }
    }

    // -------------------------------------------------------------
    // Core Entity Extraction & Controlled Resolution
    // -------------------------------------------------------------

    private void extractEntitiesAndRelationsFromText(
            String text,
            String convId,
            String convTitle,
            String msgId,
            KnowledgeNode parentConvNode
    ) {
        if (text == null || text.isBlank() || SECRET_PATTERN.matcher(text).find()) return;

        String excerpt = text.length() > 250 ? text.substring(0, 250) + "..." : text;
        KnowledgeSourceRef sourceRef = new KnowledgeSourceRef("conversation", convId, convTitle, msgId, excerpt);

        // 1. Technology & Organization Recognition
        List<KnowledgeNode> matchedTechNodes = extractTechnologyNodes(text, sourceRef);
        for (KnowledgeNode techNode : matchedTechNodes) {
            // Edge: Conversation -> MENTIONS -> Technology
            if (parentConvNode != null) {
                createEdge(
                        parentConvNode.getId(),
                        techNode.getId(),
                        "MENTIONS",
                        "Mentions",
                        "Conversation mentions " + techNode.getLabel(),
                        sourceRef,
                        1.0,
                        false
                );
            }
        }

        // 2. Project Detection
        String lower = text.toLowerCase();
        if (lower.contains("ecommerce analytics") || lower.contains("e-commerce analytics") || lower.contains("ecommerce dashboard")) {
            KnowledgeNode proj = getOrCreateNode(
                    "node-proj-ecommerce-analytics",
                    "PROJECT",
                    "E-Commerce Analytics Dashboard",
                    "Real-time analytics dashboard project with React, Spring Boot, and ClickHouse.",
                    sourceRef
            );
            if (parentConvNode != null) {
                createEdge(parentConvNode.getId(), proj.getId(), "MENTIONS", "Discusses Project",
                        "Conversation discusses project: E-Commerce Analytics Dashboard", sourceRef, 1.0, false);
            }
            for (KnowledgeNode tech : matchedTechNodes) {
                createEdge(proj.getId(), tech.getId(), "USES_TECHNOLOGY", "Uses Technology",
                        "Project uses " + tech.getLabel(), sourceRef, 1.0, false);
            }
        }

        // 3. Concept Extraction (OOP, RAG, Vector Search, etc.)
        if (lower.contains("oop") || lower.contains("object oriented") || lower.contains("object-oriented")) {
            KnowledgeNode oopNode = getOrCreateNode(
                    "node-concept-oop",
                    "CONCEPT",
                    "Object-Oriented Programming (OOP)",
                    "Programming paradigm based on the concept of objects containing data and code (encapsulation, inheritance, polymorphism, abstraction).",
                    sourceRef
            );
            oopNode.addAlias("OOP");
            oopNode.addAlias("Object-Oriented");

            Optional<KnowledgeNode> javaNode = storageService.findNodeByLabelOrAlias("Java");
            javaNode.ifPresent(kn -> createEdge(
                    kn.getId(),
                    oopNode.getId(),
                    "RELATED_TO",
                    "Implements Paradigm",
                    "Java is built fundamentally upon Object-Oriented Programming principles.",
                    sourceRef,
                    1.0,
                    false
            ));

            if (parentConvNode != null) {
                createEdge(parentConvNode.getId(), oopNode.getId(), "MENTIONS", "Mentions",
                        "Conversation discusses Object-Oriented Programming concepts.", sourceRef, 1.0, false);
            }
        }

        if (lower.contains("vector search") || lower.contains("pinecone") || lower.contains("rag") || lower.contains("retrieval augmented")) {
            KnowledgeNode ragNode = getOrCreateNode(
                    "node-concept-rag",
                    "CONCEPT",
                    "Retrieval-Augmented Generation (RAG)",
                    "Architecture combining dense vector retrieval with LLM generation for grounded, factual AI responses.",
                    sourceRef
            );
            ragNode.addAlias("RAG");
            ragNode.addAlias("Vector Search");

            Optional<KnowledgeNode> pcNode = storageService.findNodeByLabelOrAlias("Pinecone");
            pcNode.ifPresent(kn -> createEdge(
                    kn.getId(),
                    ragNode.getId(),
                    "SUPPORTS",
                    "Enables RAG",
                    "Pinecone provides serverless vector indexing for RAG retrieval pipelines.",
                    sourceRef,
                    1.0,
                    false
            ));
        }

        // 4. Decision & Task Detection
        if (lower.contains("decided to") || lower.contains("decision:") || lower.contains("architectural choice")) {
            String decisionSnippet = extractSentenceMatching(text, "(?i)(decided to|decision:|architectural choice)[^.!?\\n]+");
            if (decisionSnippet != null && !decisionSnippet.isBlank()) {
                KnowledgeNode decNode = getOrCreateNode(
                        "node-dec-" + slugify(decisionSnippet.substring(0, Math.min(25, decisionSnippet.length()))),
                        "DECISION",
                        "Architectural Decision",
                        decisionSnippet,
                        sourceRef
                );
                for (KnowledgeNode tech : matchedTechNodes) {
                    createEdge(decNode.getId(), tech.getId(), "USES_TECHNOLOGY", "Involves",
                            "Decision specifies use of " + tech.getLabel(), sourceRef, 0.9, false);
                }
            }
        }

        if (lower.contains("todo:") || lower.contains("task:") || lower.contains("need to implement") || lower.contains("unresolved")) {
            String taskSnippet = extractSentenceMatching(text, "(?i)(todo:|task:|need to implement|unresolved)[^.!?\\n]+");
            if (taskSnippet != null && !taskSnippet.isBlank()) {
                KnowledgeNode tNode = getOrCreateNode(
                        "node-task-" + slugify(taskSnippet.substring(0, Math.min(25, taskSnippet.length()))),
                        "TASK",
                        taskSnippet,
                        "Pending task extracted from dialogue: " + taskSnippet,
                        sourceRef
                );
                tNode.setStatus("UNRESOLVED");
            }
        }
    }

    private List<KnowledgeNode> extractTechnologyNodes(String text, KnowledgeSourceRef sourceRef) {
        if (text == null || text.isBlank()) return Collections.emptyList();
        List<KnowledgeNode> result = new ArrayList<>();
        String lower = text.toLowerCase();

        for (Map.Entry<String, TechDescriptor> entry : CANONICAL_TECH_MAP.entrySet()) {
            String key = entry.getKey();
            TechDescriptor desc = entry.getValue();

            boolean found = false;
            // Check canonical word boundary match
            if (containsWord(lower, key)) {
                found = true;
            } else {
                // Check aliases
                for (String alias : desc.aliases()) {
                    if (containsWord(lower, alias.toLowerCase())) {
                        found = true;
                        break;
                    }
                }
            }

            if (found) {
                KnowledgeNode node = getOrCreateNode(
                        "node-tech-" + slugify(desc.canonical()),
                        desc.category(),
                        desc.canonical(),
                        desc.description(),
                        sourceRef
                );
                for (String alias : desc.aliases()) {
                    node.addAlias(alias);
                }
                result.add(node);
            }
        }
        return result;
    }

    private void inferCrossCuttingConnections() {
        // Find React and Spring Boot
        Optional<KnowledgeNode> react = storageService.findNodeByLabelOrAlias("React");
        Optional<KnowledgeNode> spring = storageService.findNodeByLabelOrAlias("Spring Boot");
        Optional<KnowledgeNode> vite = storageService.findNodeByLabelOrAlias("Vite");
        Optional<KnowledgeNode> mui = storageService.findNodeByLabelOrAlias("Material UI");
        Optional<KnowledgeNode> yashAi = storageService.findNodeByLabelOrAlias("Yash AI");

        KnowledgeSourceRef inferredRef = new KnowledgeSourceRef("project", "system", "System Architectural Context",
                "Application tech stack integration");

        if (yashAi.isPresent()) {
            KnowledgeNode yash = yashAi.get();
            react.ifPresent(r -> createEdge(yash.getId(), r.getId(), "USES_TECHNOLOGY", "Uses Frontend",
                    "Yash AI uses React with Vite for its single-page application interface.", inferredRef, 1.0, false));
            spring.ifPresent(s -> createEdge(yash.getId(), s.getId(), "USES_TECHNOLOGY", "Uses Backend",
                    "Yash AI uses Spring Boot 4 for unified backend inference, persistent memory, and storage.", inferredRef, 1.0, false));
        }

        if (react.isPresent() && vite.isPresent()) {
            createEdge(react.get().getId(), vite.get().getId(), "RELATED_TO", "Bundled With",
                    "React client is built and served via Vite tooling.", inferredRef, 1.0, false);
        }

        if (react.isPresent() && mui.isPresent()) {
            createEdge(react.get().getId(), mui.get().getId(), "USES_TECHNOLOGY", "Component UI",
                    "React UI components are styled using Material UI v5.", inferredRef, 1.0, false);
        }
    }

    // -------------------------------------------------------------
    // Safe Node / Edge Helper Factories
    // -------------------------------------------------------------

    private KnowledgeNode getOrCreateNode(String defaultId, String type, String label, String description, KnowledgeSourceRef sourceRef) {
        Optional<KnowledgeNode> existing = storageService.findNodeByLabelOrAlias(label);
        if (existing.isPresent()) {
            KnowledgeNode node = existing.get();
            node.addSource(sourceRef);
            if (description != null && !description.isBlank() &&
                    (node.getDescription() == null || node.getDescription().length() < 20)) {
                node.setDescription(description);
            }
            node.setUpdatedAt(Instant.now().toString());
            storageService.saveToDisk();
            return node;
        }

        KnowledgeNode newNode = new KnowledgeNode(defaultId, type, label, description);
        newNode.addSource(sourceRef);
        return storageService.addOrUpdateNode(newNode);
    }

    private KnowledgeEdge createEdge(
            String sourceId,
            String targetId,
            String relation,
            String label,
            String description,
            KnowledgeSourceRef sourceRef,
            double confidence,
            boolean isInferred
    ) {
        if (sourceId == null || targetId == null || sourceId.equals(targetId)) return null;

        KnowledgeEdge edge = new KnowledgeEdge(
                "edge-" + UUID.randomUUID().toString().substring(0, 8),
                sourceId,
                targetId,
                relation,
                label
        );
        edge.setDescription(description);
        edge.setConfidence(confidence);
        edge.setInferred(isInferred);
        edge.setStatus(isInferred ? "INFERRED" : "VERIFIED");
        if (sourceRef != null) {
            edge.addSource(sourceRef);
        }

        return storageService.addOrUpdateEdge(edge);
    }

    // -------------------------------------------------------------
    // String & Word Utilities
    // -------------------------------------------------------------

    private static boolean containsWord(String haystack, String needle) {
        if (haystack == null || needle == null) return false;
        String pattern = "(?i)\\b" + Pattern.quote(needle) + "\\b";
        return Pattern.compile(pattern).matcher(haystack).find();
    }

    private static String extractSentenceMatching(String text, String regex) {
        Matcher m = Pattern.compile(regex).matcher(text);
        if (m.find()) {
            return m.group(0).trim();
        }
        return null;
    }

    private static String extractProjectName(String text) {
        if (text == null) return "E-Commerce Project";
        Matcher m = Pattern.compile("(?i)(active project:\\s*an?\\s*)([^.,\\n]+)").matcher(text);
        if (m.find()) {
            return m.group(2).trim();
        }
        return "E-Commerce Analytics Dashboard";
    }

    private static String slugify(String text) {
        if (text == null) return "entity";
        String clean = text.toLowerCase().replaceAll("[^a-z0-9]+", "-");
        clean = clean.replaceAll("^-+|-+$", "");
        return clean.isEmpty() ? "entity" : (clean.length() > 25 ? clean.substring(0, 25) : clean);
    }
}
