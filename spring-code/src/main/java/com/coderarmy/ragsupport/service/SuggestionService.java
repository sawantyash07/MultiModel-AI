package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.Conversation;
import com.coderarmy.ragsupport.service.provider.GeminiProvider;
import com.coderarmy.ragsupport.service.provider.GroqProvider;
import com.coderarmy.ragsupport.service.provider.ProviderRegistry;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for generating dynamic, context-aware suggestions and personalized prompts.
 * Generates structured suggestion objects with titles, actionable prompts, categories,
 * and clear AI vs Context-Engine provenance.
 *
 * Automatically adapts follow-ups based on:
 * 1. User's latest prompt & intent
 * 2. Assistant's complete response
 * 3. Recent conversation history and topic evolution
 * 4. Attached documents (PDF, DOCX, CSV) and images
 * 5. Selected model and response language
 */
@Service
public class SuggestionService {

    private static final Logger log = LoggerFactory.getLogger(SuggestionService.class);

    private final ConversationStorageService storageService;
    private final GeminiProvider geminiProvider;
    private final GroqProvider groqProvider;
    private final ProviderRegistry providerRegistry;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${gemini.endpoint:https://generativelanguage.googleapis.com/v1beta/openai/chat/completions}")
    private String geminiEndpoint;

    @Value("${groq.endpoint:https://api.groq.com/openai/v1/chat/completions}")
    private String groqEndpoint;

    @Value("${ollama.endpoint:http://localhost:11434/v1/chat/completions}")
    private String ollamaEndpoint;

    @Autowired
    public SuggestionService(
            ConversationStorageService storageService,
            GeminiProvider geminiProvider,
            @Autowired(required = false) GroqProvider groqProvider,
            @Autowired(required = false) ProviderRegistry providerRegistry
    ) {
        this.storageService = storageService;
        this.geminiProvider = geminiProvider;
        this.groqProvider = groqProvider;
        this.providerRegistry = providerRegistry;
    }

    /**
     * Fallback constructor for standalone test environments.
     */
    public SuggestionService(ConversationStorageService storageService) {
        this.storageService = storageService;
        this.geminiProvider = new GeminiProvider(storageService);
        this.groqProvider = new GroqProvider(storageService);
        this.providerRegistry = null;
    }

    // =========================================================================
    // Public API Methods
    // =========================================================================

    /**
     * Backward-compatible overload returning string suggestions.
     */
    public List<String> generateFollowUpSuggestions(String prompt, String answer, List<Map<String, Object>> history) {
        return generateFollowUpSuggestions(prompt, answer, history, "auto", "en");
    }

    /**
     * Backward-compatible overload returning string suggestions.
     */
    public List<String> generateFollowUpSuggestions(String prompt, String answer, List<Map<String, Object>> history, String modelId) {
        return generateFollowUpSuggestions(prompt, answer, history, modelId, "en");
    }

    /**
     * Backward-compatible overload returning string suggestions.
     */
    public List<String> generateFollowUpSuggestions(String prompt, String answer, List<Map<String, Object>> history, String modelId, String language) {
        List<Map<String, Object>> structured = generateStructuredFollowUpSuggestions(prompt, answer, history, modelId, language, null);
        List<String> plain = new ArrayList<>();
        for (Map<String, Object> item : structured) {
            String p = (String) item.get("prompt");
            if (p != null && !p.isBlank()) {
                plain.add(p);
            }
        }
        return plain;
    }

    /**
     * Generates 3 to 5 structured, contextually aware follow-up suggestions.
     * Each item contains: title, prompt, category, isAiGenerated, source, and icon.
     */
    public List<Map<String, Object>> generateStructuredFollowUpSuggestions(
            String prompt,
            String answer,
            List<Map<String, Object>> history,
            String modelId,
            String language,
            List<Map<String, Object>> attachments
    ) {
        if ((prompt == null || prompt.isBlank()) && (answer == null || answer.isBlank())) {
            return Collections.emptyList();
        }

        String effectivePrompt = (prompt != null) ? prompt.trim() : "";
        String effectiveAnswer = (answer != null) ? answer.trim() : "";
        String effectiveLang = (language != null && !language.isBlank()) ? language.trim().toLowerCase() : "en";

        // Detect domain, intent, and topic to guide both LLM prompting and contextual fallback
        DomainContext domain = detectDomainContext(effectivePrompt, effectiveAnswer, history, attachments);

        // 1. Try selected LLM based on requested modelId
        List<Map<String, Object>> suggestions = tryGenerateStructuredWithLlm(
                effectivePrompt, effectiveAnswer, history, modelId, effectiveLang, domain, attachments
        );

        if (suggestions != null && !suggestions.isEmpty()) {
            List<Map<String, Object>> cleaned = filterAndDeduplicateStructured(suggestions, effectivePrompt, history);
            if (cleaned.size() >= 3) {
                return cleaned.subList(0, Math.min(cleaned.size(), 5));
            }
            if (!cleaned.isEmpty()) {
                // Augment with non-overlapping context-engine suggestions to guarantee 3-5 high-quality choices
                List<Map<String, Object>> fallbacks = generateTopicSpecificFallbacks(effectivePrompt, effectiveAnswer, domain, effectiveLang);
                for (Map<String, Object> fb : fallbacks) {
                    if (cleaned.size() >= 4) break;
                    if (!isDuplicate(fb, cleaned, effectivePrompt, history)) {
                        cleaned.add(fb);
                    }
                }
                return cleaned;
            }
        }

        // 2. Failover to Groq (ultra-fast ~300ms)
        if (groqProvider != null && groqProvider.isConfigured()) {
            try {
                log.info("[SuggestionService] Attempting structured follow-up generation via Groq...");
                suggestions = fetchStructuredFromGroq(effectivePrompt, effectiveAnswer, history, "qwen/qwen3.8-27b", effectiveLang, domain, attachments);
                if (suggestions != null && !suggestions.isEmpty()) {
                    List<Map<String, Object>> cleaned = filterAndDeduplicateStructured(suggestions, effectivePrompt, history);
                    if (cleaned.size() >= 3) {
                        return cleaned.subList(0, Math.min(cleaned.size(), 5));
                    }
                }
            } catch (Exception e) {
                log.warn("[SuggestionService] Groq failover error: {}", e.getMessage());
            }
        }

        // 3. Failover to Gemini
        if (geminiProvider != null && geminiProvider.isConfigured()) {
            try {
                log.info("[SuggestionService] Attempting structured follow-up generation via Gemini...");
                suggestions = fetchStructuredFromGemini(effectivePrompt, effectiveAnswer, history, "gemini-3.5-flash-lite", effectiveLang, domain, attachments);
                if (suggestions != null && !suggestions.isEmpty()) {
                    List<Map<String, Object>> cleaned = filterAndDeduplicateStructured(suggestions, effectivePrompt, history);
                    if (cleaned.size() >= 3) {
                        return cleaned.subList(0, Math.min(cleaned.size(), 5));
                    }
                }
            } catch (Exception e) {
                log.warn("[SuggestionService] Gemini failover error: {}", e.getMessage());
            }
        }

        // 4. Guaranteed Safe Fallback: Highly tailored domain context engine (isAiGenerated: false)
        log.info("[SuggestionService] Generating context-engine structured suggestions for domain '{}'", domain.category);
        return generateTopicSpecificFallbacks(effectivePrompt, effectiveAnswer, domain, effectiveLang);
    }

    /**
     * Returns a human-friendly name for the current detected conversation topic.
     */
    public String detectTopicName(String prompt, String answer, List<Map<String, Object>> history, List<Map<String, Object>> attachments) {
        DomainContext ctx = detectDomainContext(prompt, answer, history, attachments);
        return ctx.topicName;
    }

    // =========================================================================
    // Domain Context Detection
    // =========================================================================

    public static class DomainContext {
        public String category;     // MEMS, JAVA_DSA, REACT, DOCUMENT, IMAGE_GEN, INDIC, GENERAL
        public String topicName;    // Human readable topic label
        public String subtopic;     // Subtopic or focal entity
        public String icon;         // Icon identifier
    }

    public DomainContext detectDomainContext(
            String prompt,
            String answer,
            List<Map<String, Object>> history,
            List<Map<String, Object>> attachments
    ) {
        DomainContext ctx = new DomainContext();
        String combined = (prompt != null ? prompt : "") + " " + (answer != null ? answer : "");
        String lower = combined.toLowerCase();

        // 1. Check Attachments first
        if (attachments != null && !attachments.isEmpty()) {
            for (Map<String, Object> att : attachments) {
                String type = (String) att.get("type");
                String name = (String) att.get("name");
                if (type != null && (type.contains("pdf") || type.contains("word") || type.contains("sheet") || type.contains("text"))
                        || (name != null && (name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".xlsx") || name.endsWith(".csv")))) {
                    ctx.category = "DOCUMENT";
                    ctx.topicName = "Document Intelligence & Analysis";
                    ctx.subtopic = (name != null) ? name : "attached document";
                    ctx.icon = "file-text";
                    return ctx;
                }
                if (type != null && type.contains("image") || (name != null && (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".webp")))) {
                    ctx.category = "IMAGE_GEN";
                    ctx.topicName = "Visual & Image Synthesis";
                    ctx.subtopic = "visual content";
                    ctx.icon = "image";
                    return ctx;
                }
            }
        }

        // 2. MEMS & Microfluidic / Hardware Engineering
        if (lower.contains("mems") || lower.contains("micropump") || lower.contains("microfluid")
                || lower.contains("piezoelectric") || lower.contains("electrostatic") || lower.contains("pull-in")
                || lower.contains("pull in voltage") || lower.contains("diaphragm") || lower.contains("cantilever")
                || lower.contains("drie") || lower.contains("lithography") || lower.contains("valveless")
                || lower.contains("pzt") || lower.contains("lab-on-a-chip") || lower.contains("microchannel")) {
            ctx.category = "MEMS";
            ctx.topicName = "MEMS Micropump & Engineering";
            ctx.subtopic = "MEMS micropump";
            ctx.icon = "cpu";
            return ctx;
        }

        // 3. Java Data Structures & Algorithms
        if (lower.contains("dsa") || (lower.contains("java") && (lower.contains("algorithm") || lower.contains("leet") || lower.contains("complexity") || lower.contains("cache") || lower.contains("array") || lower.contains("tree") || lower.contains("graph") || lower.contains("hashmap") || lower.contains("binary search") || lower.contains("dp") || lower.contains("recursion")))) {
            ctx.category = "JAVA_DSA";
            ctx.topicName = "Java Data Structures & Algorithms";
            ctx.subtopic = "Java algorithm";
            ctx.icon = "code";
            return ctx;
        }

        // 4. React & Modern Frontend Architecture
        if (lower.contains("react") || lower.contains("useeffect") || lower.contains("usememo")
                || lower.contains("usecallback") || lower.contains("usestate") || lower.contains("hook")
                || lower.contains("vite") || lower.contains("mui") || lower.contains("material ui")
                || lower.contains("component lifecycle") || lower.contains("virtual dom") || lower.contains("zustand") || lower.contains("redux")) {
            ctx.category = "REACT";
            ctx.topicName = "React & Frontend Architecture";
            ctx.subtopic = "React architecture";
            ctx.icon = "code";
            return ctx;
        }

        // 5. Image Generation / 3D Art
        if (lower.contains("generate image") || lower.contains("draw") || lower.contains("flux")
                || lower.contains("photorealistic") || lower.contains("3d robot arm") || lower.contains("concept art")
                || lower.contains("render") || lower.contains("illustration") || lower.contains("wallpaper")
                || lower.contains("cyberpunk") || lower.contains("blender")) {
            ctx.category = "IMAGE_GEN";
            ctx.topicName = "3D & Creative Image Generation";
            ctx.subtopic = "image prompt";
            ctx.icon = "image";
            return ctx;
        }

        // 6. Document Summarization & RAG
        if (lower.contains("summarize") || lower.contains("pdf") || lower.contains("document")
                || lower.contains("extract") || lower.contains("citation") || lower.contains("pinecone")
                || lower.contains("vector") || lower.contains("rag")) {
            ctx.category = "DOCUMENT";
            ctx.topicName = "Document QA & Knowledge Search";
            ctx.subtopic = "knowledge document";
            ctx.icon = "file-text";
            return ctx;
        }

        // 7. Indian Languages / Linguistics
        if (lower.contains("hindi") || lower.contains("marathi") || lower.contains("gujarati")
                || lower.contains("devanagari") || lower.contains("sanskrit") || lower.contains("translation")
                || lower.contains("indic") || lower.contains("bhasha")) {
            ctx.category = "INDIC";
            ctx.topicName = "Indian Languages & Linguistics";
            ctx.subtopic = "language translation";
            ctx.icon = "languages";
            return ctx;
        }

        // Default General Topic
        ctx.category = "GENERAL";
        ctx.topicName = extractTopicFromTokens(prompt);
        ctx.subtopic = ctx.topicName;
        ctx.icon = "sparkles";
        return ctx;
    }

    private String extractTopicFromTokens(String prompt) {
        if (prompt == null || prompt.isBlank()) return "Exploration & Deep Dive";
        String clean = prompt.replaceAll("(?i)^(explain|what is|how to|write|describe|tell me about|solve|implement)\\s+", "").trim();
        clean = clean.replaceAll("[^a-zA-Z0-9\\s]", "").trim();
        String[] words = clean.split("\\s+");
        if (words.length > 3) {
            return String.join(" ", Arrays.copyOfRange(words, 0, 3));
        }
        return !clean.isBlank() ? clean : "Core Concepts & Analysis";
    }

    // =========================================================================
    // LLM Calling & Structured JSON Parsing
    // =========================================================================

    private List<Map<String, Object>> tryGenerateStructuredWithLlm(
            String prompt,
            String answer,
            List<Map<String, Object>> history,
            String modelId,
            String language,
            DomainContext domain,
            List<Map<String, Object>> attachments
    ) {
        if (modelId == null || modelId.isBlank() || "auto".equalsIgnoreCase(modelId)) {
            if (groqProvider != null && groqProvider.isConfigured()) {
                return fetchStructuredFromGroq(prompt, answer, history, "qwen/qwen3.8-27b", language, domain, attachments);
            }
            if (geminiProvider != null && geminiProvider.isConfigured()) {
                return fetchStructuredFromGemini(prompt, answer, history, "gemini-3.5-flash-lite", language, domain, attachments);
            }
            return Collections.emptyList();
        }

        String lower = modelId.toLowerCase().trim();

        // 1. Groq models
        if (groqProvider != null && (lower.startsWith("groq/") || lower.contains("qwen3.8") || lower.contains("gpt-oss") || lower.contains("llama-3.3") || lower.equals("llama-3.1-8b-instant"))) {
            if (groqProvider.isConfigured()) {
                String resolved = groqProvider.resolveGroqModel(modelId);
                return fetchStructuredFromGroq(prompt, answer, history, resolved, language, domain, attachments);
            }
        }

        // 2. Gemini models
        if (lower.startsWith("gemini") && geminiProvider != null && geminiProvider.isConfigured()) {
            return fetchStructuredFromGemini(prompt, answer, history, "gemini-3.5-flash-lite", language, domain, attachments);
        }

        // 3. Ollama local models
        if (lower.startsWith("ollama/") || lower.contains(":7b") || lower.contains(":8b") || lower.contains(":latest")) {
            String ollamaModel = modelId.replaceFirst("^ollama/", "");
            return fetchStructuredFromOllama(prompt, answer, history, ollamaModel, language, domain, attachments);
        }

        // 4. Default to fast active provider
        if (groqProvider != null && groqProvider.isConfigured()) {
            return fetchStructuredFromGroq(prompt, answer, history, "qwen/qwen3.8-27b", language, domain, attachments);
        }
        if (geminiProvider != null && geminiProvider.isConfigured()) {
            return fetchStructuredFromGemini(prompt, answer, history, "gemini-3.5-flash-lite", language, domain, attachments);
        }

        return Collections.emptyList();
    }

    private List<Map<String, Object>> fetchStructuredFromGroq(
            String prompt, String answer, List<Map<String, Object>> history,
            String targetModel, String language, DomainContext domain, List<Map<String, Object>> attachments
    ) {
        if (groqProvider == null) return Collections.emptyList();
        String apiKey = groqProvider.getEffectiveApiKey();
        if (apiKey == null || apiKey.isBlank()) return Collections.emptyList();

        String model = (targetModel != null && !targetModel.isBlank()) ? targetModel : "qwen/qwen3.8-27b";
        String url = (groqEndpoint != null && !groqEndpoint.isBlank()) ? groqEndpoint : "https://api.groq.com/openai/v1/chat/completions";

        return callOpenAiStructuredApi(url, "Bearer " + apiKey, model, prompt, answer, history, language, domain, attachments, "groq");
    }

    private List<Map<String, Object>> fetchStructuredFromGemini(
            String prompt, String answer, List<Map<String, Object>> history,
            String targetModel, String language, DomainContext domain, List<Map<String, Object>> attachments
    ) {
        if (geminiProvider == null) return Collections.emptyList();
        String apiKey = geminiProvider.getEffectiveApiKey();
        if (apiKey == null || apiKey.isBlank()) return Collections.emptyList();

        String model = (targetModel != null && !targetModel.isBlank()) ? targetModel : "gemini-3.5-flash-lite";
        String url = (geminiEndpoint != null && !geminiEndpoint.isBlank()) ? geminiEndpoint : "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

        return callOpenAiStructuredApi(url, "Bearer " + apiKey, model, prompt, answer, history, language, domain, attachments, "gemini");
    }

    private List<Map<String, Object>> fetchStructuredFromOllama(
            String prompt, String answer, List<Map<String, Object>> history,
            String targetModel, String language, DomainContext domain, List<Map<String, Object>> attachments
    ) {
        String url = (ollamaEndpoint != null && !ollamaEndpoint.isBlank()) ? ollamaEndpoint : "http://localhost:11434/v1/chat/completions";
        return callOpenAiStructuredApi(url, null, targetModel, prompt, answer, history, language, domain, attachments, "ollama");
    }

    private List<Map<String, Object>> callOpenAiStructuredApi(
            String endpoint,
            String authHeader,
            String modelName,
            String prompt,
            String answer,
            List<Map<String, Object>> history,
            String language,
            DomainContext domain,
            List<Map<String, Object>> attachments,
            String providerLabel
    ) {
        try {
            String langInstruction = switch ((language != null) ? language.trim().toLowerCase() : "en") {
                case "hi" -> "Translate and format all suggestion titles and prompts in natural Hindi (Devanagari script).";
                case "mr" -> "Translate and format all suggestion titles and prompts in natural Marathi (Devanagari script).";
                case "gu" -> "Translate and format all suggestion titles and prompts in natural Gujarati script.";
                default -> "All suggestion titles and prompts must be written naturally in English.";
            };

            String domainGuidance = switch (domain.category) {
                case "MEMS" -> "The user is exploring MEMS / Microfluidics. Generate follow-up suggestions specifically covering: working principles, actuator mechanisms (piezoelectric vs electrostatic), pull-in voltage calculations, cleanroom fabrication (lithography/DRIE), or biomedical applications.";
                case "JAVA_DSA" -> "The user is exploring Java Data Structures & Algorithms. Generate follow-up suggestions covering: time and space complexity analysis, algorithmic optimizations, edge cases & safety, alternative data structure approaches, or related interview practice problems.";
                case "REACT" -> "The user is exploring React development. Generate follow-up suggestions covering: custom hook extraction, performance & memoization (useMemo/useCallback), component refactoring, debugging, or unit testing.";
                case "DOCUMENT" -> "The user is analyzing a document. Generate follow-up suggestions covering: executive summary, key empirical takeaways, formulas/methodology breakdown, or comprehension quiz questions.";
                case "IMAGE_GEN" -> "The user is working with image generation. Generate follow-up suggestions covering: camera angles & composition, lighting variations (volumetric, golden hour), alternative artistic styles, or detailed prompt refinements.";
                default -> "Generate 3 to 4 insightful, actionable follow-ups directly probing technical depth, edge cases, practical implementation, and next steps.";
            };

            String systemPrompt = "You are the Yash AI Context-Aware Suggestion Engine.\n" +
                    "Your task is to generate 3 to 4 actionable, highly relevant, distinct follow-up suggestions that the user would naturally ask next.\n\n" +
                    "Domain Guidelines:\n" + domainGuidance + "\n\n" +
                    "Output Rules:\n" +
                    "1. Return ONLY a valid JSON array of objects. No markdown backticks, no comments, no extra text.\n" +
                    "2. Format:\n" +
                    "[\n" +
                    "  {\n" +
                    "    \"title\": \"Short 2-4 word Title\",\n" +
                    "    \"prompt\": \"Complete, actionable question or prompt ready to submit (10-20 words)?\",\n" +
                    "    \"category\": \"Relevant Category Name\"\n" +
                    "  }\n" +
                    "]\n" +
                    "3. Non-Repetitive: Never repeat a question already asked by the user in recent history.\n" +
                    "4. " + langInstruction;

            StringBuilder userContent = new StringBuilder();
            if (attachments != null && !attachments.isEmpty()) {
                userContent.append("Attached Files:\n");
                for (Map<String, Object> att : attachments) {
                    userContent.append("- ").append(att.get("name")).append(" (").append(att.get("type")).append(")\n");
                }
                userContent.append("\n");
            }

            if (history != null && !history.isEmpty()) {
                userContent.append("Recent Dialogue History:\n");
                int start = Math.max(0, history.size() - 4);
                for (int i = start; i < history.size(); i++) {
                    Map<String, Object> m = history.get(i);
                    String role = (String) m.get("role");
                    String content = (String) m.get("content");
                    if (content != null && !content.isBlank()) {
                        String snippet = content.length() > 200 ? content.substring(0, 200) + "..." : content;
                        userContent.append(role.toUpperCase()).append(": ").append(snippet).append("\n");
                    }
                }
                userContent.append("\n");
            }

            userContent.append("User's Latest Prompt: ").append(prompt).append("\n\n");
            String trimmedAnswer = (answer != null && answer.length() > 800) ? answer.substring(0, 800) + "..." : (answer != null ? answer : "");
            userContent.append("Assistant's Complete Response:\n").append(trimmedAnswer);

            Map<String, Object> reqBody = Map.of(
                    "model", modelName,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userContent.toString())
                    ),
                    "temperature", 0.6,
                    "max_tokens", 350
            );

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .header("User-Agent", "YashAI-ContextSuggestions/2.0")
                    .timeout(Duration.ofSeconds(8))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(reqBody)));

            if (authHeader != null && !authHeader.isBlank()) {
                builder.header("Authorization", authHeader);
            }

            HttpResponse<String> resp = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(resp.body());
                JsonNode choices = root.path("choices");
                if (choices.isArray() && choices.size() > 0) {
                    String raw = choices.get(0).path("message").path("content").asText("");
                    List<Map<String, Object>> parsed = parseStructuredSuggestions(raw, domain, providerLabel);
                    if (parsed != null && !parsed.isEmpty()) {
                        log.info("[SuggestionService] Generated {} structured suggestions via LLM '{}'", parsed.size(), modelName);
                        return parsed;
                    }
                }
            } else {
                log.warn("[SuggestionService] Endpoint {} returned HTTP status {}", endpoint, resp.statusCode());
            }
        } catch (Exception e) {
            log.warn("[SuggestionService] Exception calling LLM for suggestions: {}", e.getMessage());
        }
        return Collections.emptyList();
    }

    /**
     * Parses the LLM's response into structured suggestion objects.
     * Supports JSON array of objects, JSON array of strings, or text bullets.
     */
    public List<Map<String, Object>> parseStructuredSuggestions(String raw, DomainContext domain, String providerLabel) {
        if (raw == null || raw.isBlank()) return Collections.emptyList();
        String text = cleanJsonText(raw);

        // 1. Try parsing directly as List<Map<String, Object>>
        try {
            List<Map<String, Object>> rawList = objectMapper.readValue(text, new TypeReference<List<Map<String, Object>>>() {});
            if (rawList != null && !rawList.isEmpty()) {
                List<Map<String, Object>> result = processRawObjectList(rawList, domain, providerLabel);
                if (!result.isEmpty()) return result;
            }
        } catch (Exception ignored) {}

        // 2. Try regex extraction of JSON objects: {"title": ..., "prompt": ...}
        try {
            Pattern objPattern = Pattern.compile("\\{[^\\{\\}]*\"prompt\"[^\\{\\}]*\\}", Pattern.DOTALL);
            Matcher m = objPattern.matcher(text);
            List<Map<String, Object>> extractedObjs = new ArrayList<>();
            while (m.find()) {
                try {
                    Map<String, Object> map = objectMapper.readValue(m.group(), new TypeReference<Map<String, Object>>() {});
                    if (map.containsKey("prompt") || map.containsKey("title")) {
                        extractedObjs.add(map);
                    }
                } catch (Exception ignored) {}
            }
            if (!extractedObjs.isEmpty()) {
                List<Map<String, Object>> result = processRawObjectList(extractedObjs, domain, providerLabel);
                if (!result.isEmpty()) return result;
            }
        } catch (Exception ignored) {}

        // 3. Try parsing as List<String> (array of plain string questions)
        try {
            List<String> stringList = objectMapper.readValue(text, new TypeReference<List<String>>() {});
            if (stringList != null && !stringList.isEmpty()) {
                List<Map<String, Object>> result = new ArrayList<>();
                for (String q : stringList) {
                    if (q == null || q.isBlank()) continue;
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("title", deriveTitleFromPrompt(q));
                    map.put("prompt", ensureQuestionFormat(q.trim()));
                    map.put("category", domain.topicName);
                    map.put("isAiGenerated", true);
                    map.put("source", providerLabel != null ? providerLabel : "llm");
                    map.put("icon", domain.icon);
                    result.add(map);
                }
                if (!result.isEmpty()) return result;
            }
        } catch (Exception ignored) {}

        // 4. Fallback: Parse line-by-line (ignoring raw JSON artifacts)
        List<Map<String, Object>> lineResult = new ArrayList<>();
        String[] lines = text.split("\\r?\\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;
            // Skip raw JSON structure lines
            if (trimmed.startsWith("{") || trimmed.startsWith("}") || trimmed.startsWith("[") || trimmed.startsWith("]")) continue;
            if (trimmed.matches("(?i)^\"?(title|prompt|category)\"?:.*")) continue;

            String cleaned = trimmed.replaceFirst("^(?:\\d+[.)]|[-*•])\\s*", "").trim();
            cleaned = cleaned.replaceAll("^[\"']+|[\"']+$", "").trim();
            if (cleaned.length() > 8) {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("title", deriveTitleFromPrompt(cleaned));
                map.put("prompt", ensureQuestionFormat(cleaned));
                map.put("category", domain.topicName);
                map.put("isAiGenerated", true);
                map.put("source", providerLabel != null ? providerLabel : "llm");
                map.put("icon", domain.icon);
                lineResult.add(map);
            }
        }
        return lineResult;
    }

    private List<Map<String, Object>> processRawObjectList(List<Map<String, Object>> rawList, DomainContext domain, String providerLabel) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> item : rawList) {
            String prompt = (String) item.get("prompt");
            String title = (String) item.get("title");
            String category = (String) item.get("category");

            if (prompt == null || prompt.isBlank()) {
                prompt = title;
            }
            if (prompt == null || prompt.isBlank()) continue;

            if (title == null || title.isBlank()) {
                title = deriveTitleFromPrompt(prompt);
            }
            if (category == null || category.isBlank()) {
                category = domain.topicName;
            }

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("title", title.trim());
            map.put("prompt", ensureQuestionFormat(prompt.trim()));
            map.put("category", category.trim());
            map.put("isAiGenerated", true);
            map.put("source", providerLabel != null ? providerLabel : "llm");
            map.put("icon", domain.icon);
            result.add(map);
        }
        return result;
    }

    private String deriveTitleFromPrompt(String prompt) {
        if (prompt == null || prompt.isBlank()) return "Follow-up Question";
        String clean = prompt.replaceAll("(?i)^(explain|what is|how to|can you|calculate|compare|analyze|summarize|generate)\\s+", "").trim();
        // Support all Unicode letters, numbers, and scripts (English, Hindi, Marathi, etc.)
        clean = clean.replaceAll("[^\\p{L}\\p{N}\\s]", "").trim();
        String[] words = clean.split("\\s+");
        if (words.length > 4) {
            return String.join(" ", Arrays.copyOfRange(words, 0, 4));
        }
        return !clean.isBlank() ? clean : "Follow-up Question";
    }

    private String ensureQuestionFormat(String text) {
        if (text == null) return "";
        String clean = text.trim();
        if (!clean.endsWith("?") && !clean.endsWith(".")) {
            clean += "?";
        }
        if (!clean.isEmpty()) {
            clean = Character.toUpperCase(clean.charAt(0)) + clean.substring(1);
        }
        return clean;
    }

    private String cleanJsonText(String raw) {
        if (raw == null) return "[]";
        String s = raw.trim();
        if (s.startsWith("```json")) {
            s = s.substring(7);
        } else if (s.startsWith("```")) {
            s = s.substring(3);
        }
        if (s.endsWith("```")) {
            s = s.substring(0, s.length() - 3);
        }
        int open = s.indexOf('[');
        int close = s.lastIndexOf(']');
        if (open != -1 && close > open) {
            s = s.substring(open, close + 1);
        }
        return s.trim();
    }

    // =========================================================================
    // Context-Engine Topic Fallback Generator (Honest isAiGenerated: false)
    // =========================================================================

    public List<Map<String, Object>> generateTopicSpecificFallbacks(
            String prompt,
            String answer,
            DomainContext domain,
            String language
    ) {
        List<Map<String, Object>> list = new ArrayList<>();
        boolean isHindi = "hi".equalsIgnoreCase(language);
        boolean isMarathi = "mr".equalsIgnoreCase(language);

        switch (domain.category) {
            case "MEMS" -> {
                list.add(createFallbackItem(
                        isHindi ? "एक्चुएटर तंत्र तुलना" : isMarathi ? "ॲक्च्युएटर यंत्रणा तुलना" : "Actuator Mechanisms",
                        isHindi ? "MEMS माइक्रोपंप में पीजोइलेक्ट्रिक, इलेक्ट्रोस्टैटिक और थर्मोप्यूमेटिक एक्चुएशन की तुलना करें।"
                                : isMarathi ? "MEMS मायक्रोपंपमध्ये पायझोइलेक्ट्रिक आणि इलेक्ट्रोस्टॅटिक ॲक्च्युएशनमधील फरक स्पष्ट करा."
                                : "Compare piezoelectric, electrostatic, and thermopneumatic actuator mechanisms for MEMS micropumps in terms of stroke volume and voltage.",
                        "Actuation & Physics",
                        "cpu"
                ));
                list.add(createFallbackItem(
                        isHindi ? "पुल-इन वोल्टेज गणना" : isMarathi ? "पुल-इन व्होल्टेज गणना" : "Pull-in Voltage Calculation",
                        isHindi ? "इलेक्ट्रोस्टैटिक माइक्रोपंप के लिए पुल-इन वोल्टेज और डायफ्राम डिफ्लेक्शन की गणना कैसे की जाती है?"
                                : isMarathi ? "इलेक्ट्रोस्टॅटिक मायक्रोपंपसाठी पुल-इन व्होल्टेज आणि डायफ्राम डिफ्लेक्शनचे सूत्र काय आहे?"
                                : "How do you calculate the electrostatic pull-in voltage and diaphragm deflection limits for silicon micropumps?",
                        "Formulas & Mechanics",
                        "cpu"
                ));
                list.add(createFallbackItem(
                        isHindi ? "क्लीनरूम फैब्रिकेशन" : isMarathi ? "क्लीनरूम फॅब्रिकेशन" : "Fabrication & Lithography",
                        isHindi ? "सिलिकॉन माइक्रोपंप निर्माण के लिए डीप रिएक्टिव आयन एचिंग (DRIE) और वेफर बॉन्डिंग प्रक्रिया समझाएं।"
                                : isMarathi ? "सिलिकॉन मायक्रोपंपसाठी DRIE आणि वेफर बाँडिंग प्रक्रिया कशी कार्य करते?"
                                : "What are the standard cleanroom fabrication steps (photolithography, DRIE etching, anodic wafer bonding) for MEMS micropumps?",
                        "Microfabrication",
                        "cpu"
                ));
                list.add(createFallbackItem(
                        isHindi ? "बायोमेडिकल अनुप्रयोग" : isMarathi ? "बायोमेडिकल ऍप्लिकेशन्स" : "Biomedical Applications",
                        isHindi ? "इंसुलिन डिलीवरी और लैब-ऑन-अ-चिप डायग्नोस्टिक्स में वाल्वलेस माइक्रोपंप कैसे काम करते हैं?"
                                : isMarathi ? "इन्सुलिन डिलिव्हरी आणि लॅब-ऑन-अ-चिपमध्ये व्हॉल्व्हलेस मायक्रोपंपचा वापर कसा होतो?"
                                : "How are valveless diffuser/nozzle MEMS micropumps applied in transdermal insulin delivery and point-of-care diagnostics?",
                        "Biomedical Engineering",
                        "cpu"
                ));
            }
            case "JAVA_DSA" -> {
                list.add(createFallbackItem(
                        isHindi ? "समय और स्पेस जटिलता" : isMarathi ? "टाइम आणि स्पेस कॉम्प्लेक्सिटी" : "Complexity Analysis",
                        isHindi ? "इस समाधान की एसिम्प्टोटिक समय और स्पेस जटिलता (Big-O) का चरण-दर-चरण विश्लेषण करें।"
                                : isMarathi ? "या अल्गोरिदमच्या टाईम आणि स्पेस कॉम्प्लेक्सिटीचे Big-O विश्‍लेषण करा."
                                : "Analyze the asymptotic time and space complexity (Big-O) of this solution and identify any memory bottlenecks.",
                        "Algorithm Optimization",
                        "code"
                ));
                list.add(createFallbackItem(
                        isHindi ? "एज केस और सुरक्षा" : isMarathi ? "एज केसेस आणि व्हॅलिडेशन" : "Edge Cases & Safety",
                        isHindi ? "नल इनपुट्स, ओवरफ्लो, और खाली डेटा स्ट्रक्चर जैसे कौन से एज केस इस एल्गोरिदम में जरूरी हैं?"
                                : isMarathi ? "रिकामे इनपुट्स आणि ओव्हरफ्लोसारखे कोणते एज केसेस हाताळणे आवश्यक आहे?"
                                : "What edge cases (null inputs, integer overflow, empty collections, duplicate keys) must be handled for this algorithm?",
                        "Code Robustness",
                        "code"
                ));
                list.add(createFallbackItem(
                        isHindi ? "वैकल्पिक डेटा संरचनाएं" : isMarathi ? "पर्यायी डेटा स्ट्रक्चर्स" : "Alternative Solutions",
                        isHindi ? "क्या इस समस्या को किसी अन्य डेटा संरचना (जैसे TreeMap या Segment Tree) से बेहतर हल किया जा सकता है?"
                                : isMarathi ? "ही समस्या इतर डेटा स्ट्रक्चर वापरून अधिक प्रभावीपणे सोडवता येईल का?"
                                : "How would using an alternative data structure (e.g. TreeMap vs HashMap, or custom Doubly Linked List) impact trade-offs?",
                        "Data Structures",
                        "code"
                ));
                list.add(createFallbackItem(
                        isHindi ? "अभ्यास प्रश्न" : isMarathi ? "सराव प्रश्न" : "Practice Problem",
                        isHindi ? "इस एल्गोरिदम सिद्धांत पर आधारित 2 मुख्य इंटरव्यू प्रश्न और उनके समाधान सुझाएं।"
                                : isMarathi ? "या संकल्पनेवर आधारित दोन महत्त्वाचे इंटरव्ह्यू प्रश्न सुचवा."
                                : "What are the most common interview variations or related LeetCode problems based on this algorithmic pattern?",
                        "Interview Prep",
                        "code"
                ));
            }
            case "REACT" -> {
                list.add(createFallbackItem(
                        isHindi ? "कस्टम हुक एक्सट्रैक्शन" : isMarathi ? "कस्टम हुक तयार करा" : "Custom Hook Extraction",
                        isHindi ? "इस लॉजिक को एक पुन: प्रयोज्य कस्टम रिएक्ट हुक (TypeScript के साथ) में कैसे बदलें?"
                                : isMarathi ? "हे लॉजिक पुन्हा वापरण्यायोग्य कस्टम रिएक्ट हुकमध्ये कसे रूपांतरित करावे?"
                                : "How can we extract this stateful logic into a reusable custom React hook with TypeScript types and cancel handling?",
                        "Frontend Architecture",
                        "code"
                ));
                list.add(createFallbackItem(
                        isHindi ? "प्रदर्शन अनुकूलन" : isMarathi ? "परफॉर्मन्स ऑप्टिमायझेशन" : "Performance & Memoization",
                        isHindi ? "अनावश्यक री-रेंडरिंग रोकने के लिए useMemo, useCallback और React.memo का उपयोग कैसे करें?"
                                : isMarathi ? "अनावश्यक री-रेंडर थांबवण्यासाठी useMemo आणि useCallback कसे वापरावे?"
                                : "Where might unnecessary re-renders occur, and how should useMemo, useCallback, or React.memo be applied here?",
                        "Performance Tuning",
                        "code"
                ));
                list.add(createFallbackItem(
                        isHindi ? "यूनिट परीक्षण" : isMarathi ? "युनिट चाचण्या" : "Unit Testing with Vitest",
                        isHindi ? "रिएक्ट टेस्टिंग लाइब्रेरी और Vitest का उपयोग करके इस घटक के लिए संपूर्ण यूनिट टेस्ट लिखें।"
                                : isMarathi ? "Vitest आणि React Testing Library वापरून या घटकासाठी युनिट चाचण्या लिहा."
                                : "Write comprehensive unit tests for this React component using Vitest and React Testing Library covering edge states.",
                        "Testing & Quality",
                        "code"
                ));
            }
            case "DOCUMENT" -> {
                list.add(createFallbackItem(
                        isHindi ? "कार्यकारी सारांश" : isMarathi ? "थोडक्यात सारांश" : "Executive Summary",
                        isHindi ? "इस दस्तावेज़ के मुख्य निष्कर्ष, कार्यप्रणाली और निष्कर्षों का एक संक्षिप्त सारांश प्रदान करें।"
                                : isMarathi ? "या दस्तऐवजाचा महत्त्वाचा कार्यकारी सारांश मुख्य निष्कर्षांसह द्या."
                                : "Provide a structured executive summary highlighting the primary problem statement, methodology, and key findings.",
                        "Document Intelligence",
                        "file-text"
                ));
                list.add(createFallbackItem(
                        isHindi ? "मुख्य डेटा और मेट्रिक्स" : isMarathi ? "महत्त्वाचा डेटा व आकडेवारी" : "Extract Key Metrics",
                        isHindi ? "दस्तावेज़ में दिए गए सभी अनुभवजन्य परिणाम, प्रतिशत और महत्वपूर्ण आंकड़ों की एक तालिका बनाएं।"
                                : isMarathi ? "दस्तऐवजातील सर्व महत्त्वाचे आकडे आणि निकाल तक्त्याच्या स्वरूपात काढा."
                                : "Extract and tabulate all quantitative metrics, empirical benchmarks, and experimental data points from the document.",
                        "Data Extraction",
                        "file-text"
                ));
                list.add(createFallbackItem(
                        isHindi ? "समझ प्रश्नोत्तरी" : isMarathi ? "आकलन प्रश्नमंजुषा" : "Comprehension Questions",
                        isHindi ? "इस दस्तावेज़ की सामग्री पर आधारित 5 महत्वपूर्ण प्रश्न बनाएं जो मुख्य अवधारणाओं का परीक्षण करते हैं।"
                                : isMarathi ? "या दस्तऐवजातील संकल्पनांवर आधारित ५ महत्त्वाचे प्रश्न तयार करा."
                                : "Generate 5 critical comprehension questions with answer keys to test deep understanding of this document's concepts.",
                        "Deep Learning",
                        "file-text"
                ));
            }
            case "IMAGE_GEN" -> {
                list.add(createFallbackItem(
                        isHindi ? "सिनेमैटिक प्रकाश व्यवस्था" : isMarathi ? "सिनेमॅटिक लाइटिंग" : "Cinematic Lighting",
                        isHindi ? "इस दृश्य को वॉल्यूमेट्रिक लाइटिंग, गोल्डन ऑवर रिफ्लेक्शन और 8k रेंडर विवरण के साथ बेहतर बनाएं।"
                                : isMarathi ? "या दृश्यामध्ये व्हॉल्यूमेट्रिक लाइटिंग आणि 8k रेंडर तपशील जोडा."
                                : "Enhance this scene with volumetric lighting, golden hour rim reflections, and high-contrast ambient occlusion in 8k.",
                        "Lighting & Atmosphere",
                        "image"
                ));
                list.add(createFallbackItem(
                        isHindi ? "कैमरा कोण और परिप्रेक्ष्य" : isMarathi ? "कॅमेरा अँगल आणि रचना" : "Camera Angles & Macro",
                        isHindi ? "यांत्रिक सतह की बनावट को उजागर करते हुए इसे एक अत्यधिक क्लोज-अप मैक्रो कोण से प्रस्तुत करें।"
                                : isMarathi ? "यांत्रिक पोत स्पष्ट करण्यासाठी अत्यंत क्लोज-अप मॅक्रो अँगलने हे तयार करा."
                                : "Render this subject from an extreme close-up macro lens angle emphasizing mechanical surface textures and depth of field.",
                        "Composition",
                        "image"
                ));
                list.add(createFallbackItem(
                        isHindi ? "साइबरपंक कला शैली" : isMarathi ? "सायबरपंक कला शैली" : "Stylistic Variation",
                        isHindi ? "इस विषय को नियॉन एक्सेंट और ब्लूप्रिंट लाइनों के साथ आइसोमेट्रिक साइबरपंक शैली में फिर से बनाएं।"
                                : isMarathi ? "निऑन अ‍ॅक्सेंटसह आयसोमेट्रिक सायबरपंक शैलीमध्ये हे दृश्य पुन्हा तयार करा."
                                : "Reimagine this subject in an isometric cyberpunk concept art style with neon green accents and blueprint schematics.",
                        "Artistic Styles",
                        "image"
                ));
            }
            default -> {
                String topic = domain.topicName;
                list.add(createFallbackItem(
                        isHindi ? "व्यावहारिक कार्यान्वयन" : isMarathi ? "प्रायोगिक उदाहरण" : "Practical Implementation",
                        isHindi ? topic + " का एक विस्तृत व्यावहारिक और वास्तविक उदाहरण कोड के साथ समझाएं।"
                                : isMarathi ? topic + " चे कोडसह सविस्तर प्रायोगिक उदाहरण द्या."
                                : "Can you walk through a step-by-step practical implementation or real-world example of " + topic + "?",
                        "Practical Application",
                        "sparkles"
                ));
                list.add(createFallbackItem(
                        isHindi ? "सामान्य गलतियां और समाधान" : isMarathi ? "सामान्य त्रुटी व उपाय" : "Common Pitfalls & Edge Cases",
                        isHindi ? topic + " में काम करते समय कौन सी मुख्य गलतियां या कमियां आती हैं?"
                                : isMarathi ? topic + " मध्ये काम करताना कोणत्या मुख्य त्रुटी येतात आणि त्या कशा टाळाव्यात?"
                                : "What are the most common pitfalls, edge cases, and anti-patterns when implementing " + topic + "?",
                        "Best Practices",
                        "sparkles"
                ));
                list.add(createFallbackItem(
                        isHindi ? "सर्वोत्तम अभ्यास तुलना" : isMarathi ? "सर्वोत्तम पद्धतींची तुलना" : "Architecture & Alternatives",
                        isHindi ? "यह दृष्टिकोण उद्योग के अन्य आधुनिक तरीकों और सर्वोत्तम अभ्यासों की तुलना में कैसा है?"
                                : isMarathi ? "हा दृष्टिकोन इतर आधुनिक पद्धतींच्या तुलनेत कसा आहे?"
                                : "How does this approach compare to modern industry alternatives in terms of trade-offs and scalability?",
                        "Comparative Analysis",
                        "sparkles"
                ));
            }
        }

        return list;
    }

    private Map<String, Object> createFallbackItem(String title, String prompt, String category, String icon) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("title", title);
        map.put("prompt", prompt);
        map.put("category", category);
        map.put("isAiGenerated", false); // Honest provenance: Rule/Context engine
        map.put("source", "context-engine");
        map.put("icon", icon != null ? icon : "sparkles");
        return map;
    }

    // =========================================================================
    // Deduplication & Filtering
    // =========================================================================

    private List<Map<String, Object>> filterAndDeduplicateStructured(
            List<Map<String, Object>> suggestions,
            String prompt,
            List<Map<String, Object>> history
    ) {
        if (suggestions == null || suggestions.isEmpty()) return Collections.emptyList();

        Set<String> seen = new HashSet<>();
        if (prompt != null) {
            seen.add(normalizeString(prompt));
        }
        if (history != null) {
            for (Map<String, Object> m : history) {
                String role = (String) m.get("role");
                String content = (String) m.get("content");
                if ("user".equalsIgnoreCase(role) && content != null) {
                    seen.add(normalizeString(content));
                }
            }
        }

        List<Map<String, Object>> filtered = new ArrayList<>();
        Set<String> itemTitles = new HashSet<>();

        for (Map<String, Object> s : suggestions) {
            String p = (String) s.get("prompt");
            String t = (String) s.get("title");
            if (p == null || p.length() < 6) continue;

            String normP = normalizeString(p);
            String normT = (t != null) ? normalizeString(t) : normP;

            if (!seen.contains(normP) && !itemTitles.contains(normT)) {
                filtered.add(s);
                seen.add(normP);
                itemTitles.add(normT);
            }
        }

        return filtered;
    }

    private boolean isDuplicate(Map<String, Object> item, List<Map<String, Object>> existing, String prompt, List<Map<String, Object>> history) {
        String p = (String) item.get("prompt");
        if (p == null) return true;
        String norm = normalizeString(p);

        if (prompt != null && normalizeString(prompt).equals(norm)) return true;

        for (Map<String, Object> ex : existing) {
            String ep = (String) ex.get("prompt");
            if (ep != null && normalizeString(ep).equals(norm)) return true;
        }

        if (history != null) {
            for (Map<String, Object> m : history) {
                String content = (String) m.get("content");
                if (content != null && normalizeString(content).equals(norm)) return true;
            }
        }
        return false;
    }

    private String normalizeString(String s) {
        if (s == null) return "";
        return s.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    // =========================================================================
    // Dynamic Dashboard & Personalized Starters
    // =========================================================================

    /**
     * Generates dynamic starter cards and suggestion chips for new conversations.
     * Analyzes stored conversation history to tailor cards and chips to the user's
     * real topics (e.g. MEMS, Java DSA, React, Documents, Image Gen), or provides a
     * rich balanced set if no prior history exists.
     */
    public Map<String, Object> generatePersonalizedDashboardSuggestions() {
        List<Conversation> convs = storageService.getAllConversations(null);

        List<String> userPrompts = new ArrayList<>();
        if (convs != null) {
            for (Conversation c : convs) {
                if (c.getMessages() != null) {
                    for (Map<String, Object> m : c.getMessages()) {
                        if ("user".equalsIgnoreCase((String) m.get("role"))) {
                            String content = (String) m.get("content");
                            if (content != null && !content.isBlank()) {
                                userPrompts.add(content.toLowerCase());
                            }
                        }
                    }
                }
            }
        }

        boolean hasMems = userPrompts.stream().anyMatch(p -> p.contains("mems") || p.contains("micropump") || p.contains("piezoelectric") || p.contains("fluid"));
        boolean hasJava = userPrompts.stream().anyMatch(p -> p.contains("java") || p.contains("dsa") || p.contains("algorithm") || p.contains("leetcode") || p.contains("lru"));
        boolean hasReact = userPrompts.stream().anyMatch(p -> p.contains("react") || p.contains("hook") || p.contains("frontend") || p.contains("component"));
        boolean hasImage = userPrompts.stream().anyMatch(p -> p.contains("image") || p.contains("flux") || p.contains("draw") || p.contains("render") || p.contains("robot arm"));
        boolean hasDoc = userPrompts.stream().anyMatch(p -> p.contains("pdf") || p.contains("document") || p.contains("summarize") || p.contains("pinecone") || p.contains("rag"));
        boolean hasIndic = userPrompts.stream().anyMatch(p -> p.contains("hindi") || p.contains("marathi") || p.contains("gujarati") || p.contains("translation"));

        List<Map<String, Object>> cards = new ArrayList<>();
        List<Map<String, Object>> chips = new ArrayList<>();

        // 1. Dynamic Feature Cards (5 cards total)
        // Card 1: Code & Debug (adaptive prompt)
        cards.add(Map.of(
                "id", "code-debug",
                "title", "Code & Debug",
                "icon", "code",
                "iconColor", "#3b82f6",
                "iconBg", "rgba(59, 130, 246, 0.12)",
                "description", hasJava
                        ? "Master advanced Java DSA: Concurrency, Trie, and LRU Cache with zero allocation."
                        : "Generate robust algorithms, debug syntax errors, optimize queries, and master DSA.",
                "prompt", hasJava
                        ? "Solve a DSA problem in Java: Implement a Thread-Safe, Concurrent LRU Cache with O(1) get and put operations using ReentrantReadWriteLock, with unit tests."
                        : "Solve a DSA problem in Java: Implement an optimized LRU Cache with O(1) get and put operations, including full comments and unit test cases.",
                "category", "Algorithms & Code"
        ));

        // Card 2: Explain Concepts (adaptive prompt)
        cards.add(Map.of(
                "id", "explain-concepts",
                "title", "Explain Concepts",
                "icon", "brain",
                "iconColor", "#8b5cf6",
                "iconBg", "rgba(139, 92, 246, 0.12)",
                "description", hasMems
                        ? "Deep dive into MEMS microfluidics, electrostatic pull-in voltage, and DRIE cleanroom fabrication."
                        : "Break down complex engineering, science, and AI topics with lucid intuition.",
                "prompt", hasMems
                        ? "Explain the pull-in voltage, critical diaphragm deflection, and fluid-structure interaction of an electrostatic MEMS micropump with formulas."
                        : "Explain the working principles, actuation mechanisms, and biomedical applications of a MEMS micropump. Include a clear ASCII architecture diagram.",
                "category", "Science & Engineering"
        ));

        // Card 3: Generate Images (adaptive prompt)
        cards.add(Map.of(
                "id", "generate-images",
                "title", "Generate Images",
                "icon", "image",
                "iconColor", "#ec4899",
                "iconBg", "rgba(236, 72, 153, 0.12)",
                "description", hasImage
                        ? "Synthesize photorealistic 3D renders, cinematic lighting, and futuristic engineering schematics."
                        : "Synthesize photorealistic concept art, diagrams, and 3D renders with FLUX.",
                "prompt", "Generate a 3D photorealistic robotic manipulator arm with carbon-fiber chassis and glowing emerald status joints in an engineering cleanroom.",
                "category", "Creative Synthesis"
        ));

        // Card 4: Analyze Documents (adaptive prompt)
        cards.add(Map.of(
                "id", "analyze-documents",
                "title", "Analyze Documents",
                "icon", "file-text",
                "iconColor", "#f59e0b",
                "iconBg", "rgba(245, 158, 11, 0.12)",
                "description", hasDoc
                        ? "Perform deep citation-backed QA, extract empirical tables, and verify claims with RAG."
                        : "Parse PDFs, spreadsheets, and technical docs with citation-backed QA.",
                "prompt", "Summarize the attached document into structured takeaways: 1. Core Problem, 2. Key Breakthroughs, 3. Empirical Results, 4. Limitations.",
                "category", "Document QA"
        ));

        // Card 5: Plan & Be Productive / Indian Languages (adaptive prompt)
        if (hasIndic) {
            cards.add(Map.of(
                    "id", "indian-languages",
                    "title", "Indian Languages",
                    "icon", "languages",
                    "iconColor", "#10b981",
                    "iconBg", "rgba(16, 185, 129, 0.12)",
                    "description", "Translate, reason, and converse fluently in Hindi, Marathi, Gujarati, and other Indic languages.",
                    "prompt", "Explain the concept of quantum computing in simple Hindi with everyday real-world analogies (क्वांटम कंप्यूटिंग को सरल हिंदी में समझाएं).",
                    "category", "Indic Linguistics"
            ));
        } else {
            cards.add(Map.of(
                    "id", "plan-productive",
                    "title", "Plan & Be Productive",
                    "icon", "check-circle",
                    "iconColor", "#10b981",
                    "iconBg", "rgba(16, 185, 129, 0.12)",
                    "description", "Draft architecture roadmaps, organize study schedules, and structure workflows.",
                    "prompt", "Create an intensive 30-day mastery schedule for Computer Science engineering exams (OS, DBMS, Networks, and DSA) with spaced repetition.",
                    "category", "Productivity & Roadmaps"
            ));
        }

        // 2. Dynamic Suggestion Chips (5 chips total, evolving based on history)
        if (hasMems) {
            chips.add(Map.of(
                    "label", "MEMS micropump pull-in voltage & formulas",
                    "prompt", "Calculate the electrostatic pull-in voltage and diaphragm deflection for a silicon MEMS micropump.",
                    "category", "MEMS Engineering"
            ));
        } else {
            chips.add(Map.of(
                    "label", "Explain MEMS micropump with diagram",
                    "prompt", "Explain the working principles of a MEMS micropump with an ASCII diagram of chambers, check valves, and diaphragm displacement.",
                    "category", "Science & Engineering"
            ));
        }

        if (hasJava) {
            chips.add(Map.of(
                    "label", "Solve Word Ladder with Bidirectional BFS",
                    "prompt", "Solve the Word Ladder problem in Java using Bidirectional BFS with detailed time and space complexity analysis.",
                    "category", "Java DSA"
            ));
        } else {
            chips.add(Map.of(
                    "label", "Solve a DSA problem in Java",
                    "prompt", "Solve the Word Ladder problem in Java using Bidirectional BFS with detailed time and space complexity analysis.",
                    "category", "Algorithms"
            ));
        }

        chips.add(Map.of(
                "label", "Generate a 3D robot arm image",
                "prompt", "Generate a 3D photorealistic robotic manipulator arm with carbon fiber joints and glowing emerald rings in a cleanroom, 8k render.",
                "category", "Image Gen"
        ));

        if (hasDoc) {
            chips.add(Map.of(
                    "label", "Extract key empirical tables from PDF",
                    "prompt", "Please extract all empirical benchmark tables and quantitative metrics from this PDF with comparative analysis.",
                    "category", "Document QA"
            ));
        } else {
            chips.add(Map.of(
                    "label", "Summarize this PDF",
                    "prompt", "Please summarize this document into an executive summary, key technical contributions, benchmarks, and actionable insights.",
                    "category", "Document QA"
            ));
        }

        if (hasIndic) {
            chips.add(Map.of(
                    "label", "Translate & explain in Hindi / Marathi",
                    "prompt", "Explain how neural networks learn backpropagation in conversational Hindi with clear step-by-step math.",
                    "category", "Indian Languages"
            ));
        } else {
            chips.add(Map.of(
                    "label", "Latest AI news from internet",
                    "prompt", "Search the live web for the latest artificial intelligence news, model releases, and research breakthroughs from this week with citations.",
                    "category", "Web Search"
            ));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("cards", cards);
        result.put("chips", chips);
        return result;
    }

    /**
     * Backward-compatible helper for existing callers.
     */
    public List<Map<String, String>> generatePersonalizedSuggestions() {
        Map<String, Object> dash = generatePersonalizedDashboardSuggestions();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cards = (List<Map<String, Object>>) dash.get("cards");
        List<Map<String, String>> converted = new ArrayList<>();
        if (cards != null) {
            for (Map<String, Object> c : cards) {
                converted.add(Map.of(
                        "title", String.valueOf(c.get("title")),
                        "prompt", String.valueOf(c.get("prompt")),
                        "category", String.valueOf(c.get("category")),
                        "color", String.valueOf(c.get("iconColor"))
                ));
            }
        }
        return converted;
    }
}
