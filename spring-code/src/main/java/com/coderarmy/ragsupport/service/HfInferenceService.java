package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.hub.model.ImageGenerationRequest;
import com.coderarmy.ragsupport.hub.model.ImageGenerationResponse;
import com.coderarmy.ragsupport.hub.service.HubRegistryService;
import com.coderarmy.ragsupport.hub.service.TextToImageService;
import com.coderarmy.ragsupport.model.Conversation;
import com.coderarmy.ragsupport.model.PastConversationExcerpt;
import com.coderarmy.ragsupport.model.ProjectContext;
import com.coderarmy.ragsupport.model.ResearchVerificationResult;
import com.coderarmy.ragsupport.model.UserMemory;
import com.coderarmy.ragsupport.model.WebSearchResult;
import com.coderarmy.ragsupport.service.provider.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Production AI Inference Coordinator service.
 * Dispatches to configurable inference providers (Google Gemini Free Hosted, Groq LPU, Local Ollama, Hugging Face).
 * Seamlessly integrates Persistent AI Memory, Project Continuation Context, Cross-Chat Past Excerpts,
 * Live Web Research, Fact Verification, and Strict Anti-Hallucination directives.
 */
@Service
public class HfInferenceService {

    private static final Logger log = LoggerFactory.getLogger(HfInferenceService.class);

    private final HfModelService hfModelService;
    private final ConversationStorageService conversationStorageService;
    private final ProviderRegistry providerRegistry;
    private final UserMemoryService userMemoryService;
    private final FactVerificationService factVerificationService;
    private final TextToImageService textToImageService;
    private final DocumentIntelligenceService documentIntelligenceService;
    @Autowired(required = false)
    private com.coderarmy.ragsupport.service.kg.KnowledgeExtractionPipeline knowledgeExtractionPipeline;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public HfInferenceService(
            HfModelService hfModelService,
            ConversationStorageService conversationStorageService,
            ProviderRegistry providerRegistry,
            UserMemoryService userMemoryService,
            FactVerificationService factVerificationService,
            @Autowired(required = false) TextToImageService textToImageService,
            @Autowired(required = false) DocumentIntelligenceService documentIntelligenceService
    ) {
        this.hfModelService = hfModelService;
        this.conversationStorageService = conversationStorageService;
        this.providerRegistry = providerRegistry;
        this.userMemoryService = userMemoryService;
        this.factVerificationService = factVerificationService;
        this.textToImageService = textToImageService;
        this.documentIntelligenceService = documentIntelligenceService != null ? documentIntelligenceService : new DocumentIntelligenceService();
    }

    public HfInferenceService(
            HfModelService hfModelService,
            ConversationStorageService conversationStorageService,
            ProviderRegistry providerRegistry,
            UserMemoryService userMemoryService,
            FactVerificationService factVerificationService,
            @Autowired(required = false) TextToImageService textToImageService
    ) {
        this(hfModelService, conversationStorageService, providerRegistry, userMemoryService, factVerificationService, textToImageService, new DocumentIntelligenceService());
    }

    public HfInferenceService(
            HfModelService hfModelService,
            ConversationStorageService conversationStorageService,
            ProviderRegistry providerRegistry,
            UserMemoryService userMemoryService,
            FactVerificationService factVerificationService
    ) {
        this(hfModelService, conversationStorageService, providerRegistry, userMemoryService, factVerificationService, null, new DocumentIntelligenceService());
    }

    public HfInferenceService(
            HfModelService hfModelService,
            ConversationStorageService conversationStorageService,
            ProviderRegistry providerRegistry
    ) {
        this(hfModelService, conversationStorageService, providerRegistry, new UserMemoryService(), new FactVerificationService(new WebSearchService()), null, new DocumentIntelligenceService());
    }

    /**
     * Fallback constructor for standalone test environments.
     */
    public HfInferenceService(
            HfModelService hfModelService,
            ConversationStorageService conversationStorageService
    ) {
        this.hfModelService = hfModelService;
        this.conversationStorageService = conversationStorageService;
        ConversationStorageService storage = conversationStorageService != null ? conversationStorageService : new ConversationStorageService();
        GroqProvider groq = new GroqProvider(storage);
        GeminiProvider gem = new GeminiProvider(storage, groq);
        OllamaProvider oll = new OllamaProvider(storage);
        HfInferenceProvider hf = new HfInferenceProvider(storage);
        this.providerRegistry = new ProviderRegistry(gem, oll, hf, groq);
        this.userMemoryService = new UserMemoryService();
        this.factVerificationService = new FactVerificationService(new WebSearchService());
        this.textToImageService = new TextToImageService(new HubRegistryService());
        this.documentIntelligenceService = new DocumentIntelligenceService();
    }

    private ServerSentEvent<String> createSseEvent(String eventName, Map<String, Object> dataMap) {
        try {
            String jsonStr = objectMapper.writeValueAsString(dataMap);
            return ServerSentEvent.<String>builder()
                    .event(eventName)
                    .data(jsonStr)
                    .build();
        } catch (Exception e) {
            return ServerSentEvent.<String>builder()
                    .event(eventName)
                    .data("{}")
                    .build();
        }
    }

    public Flux<ServerSentEvent<String>> streamInference(
            String conversationId,
            String requestedModelId,
            List<Map<String, Object>> messages,
            List<Map<String, Object>> attachments,
            String systemInstruction
    ) {
        return streamInference(conversationId, requestedModelId, messages, attachments, systemInstruction, "en");
    }

    public Flux<ServerSentEvent<String>> streamInference(
            String conversationId,
            String requestedModelId,
            List<Map<String, Object>> messages,
            List<Map<String, Object>> attachments,
            String systemInstruction,
            String language
    ) {
        return streamInference(conversationId, requestedModelId, messages, attachments, systemInstruction, language, null);
    }

    public Flux<ServerSentEvent<String>> streamInference(
            String conversationId,
            String requestedModelId,
            List<Map<String, Object>> messages,
            List<Map<String, Object>> attachments,
            String systemInstruction,
            String language,
            Boolean webSearchOverride
    ) {
        return streamInference(conversationId, requestedModelId, messages, attachments, systemInstruction, language, webSearchOverride, false);
    }

    public Flux<ServerSentEvent<String>> streamInference(
            String conversationId,
            String requestedModelId,
            List<Map<String, Object>> messages,
            List<Map<String, Object>> attachments,
            String systemInstruction,
            String language,
            Boolean webSearchOverride,
            Boolean allowFallback
    ) {
        String reqId = "req-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 7);
        String msgId = "msg-" + System.currentTimeMillis() + "-assistant";
        return streamInference(conversationId, requestedModelId, messages, attachments, systemInstruction, language, webSearchOverride, allowFallback, reqId, msgId);
    }

    public Flux<ServerSentEvent<String>> streamInference(
            String conversationId,
            String requestedModelId,
            List<Map<String, Object>> messages,
            List<Map<String, Object>> attachments,
            String systemInstruction,
            String language,
            Boolean webSearchOverride,
            Boolean allowFallback,
            String requestId,
            String messageId
    ) {
        long startTime = System.currentTimeMillis();
        final String effectiveReqId = (requestId != null && !requestId.isBlank())
                ? requestId
                : ("req-" + startTime + "-" + UUID.randomUUID().toString().substring(0, 7));
        final String effectiveMsgId = (messageId != null && !messageId.isBlank())
                ? messageId
                : ("msg-" + startTime + "-assistant");

        // 1. Resolve requested model ID and its target provider
        String targetModelId = hfModelService.resolveModelId(requestedModelId);

        // Check for Image Generation Intent when model is auto or general
        String checkPrompt = "";
        if (messages != null && !messages.isEmpty()) {
            for (int i = messages.size() - 1; i >= 0; i--) {
                Map<String, Object> m = messages.get(i);
                if ("user".equalsIgnoreCase((String) m.get("role"))) {
                    checkPrompt = (String) m.get("content");
                    break;
                }
            }
        }
        boolean isExplicitImagePrompt = checkPrompt != null &&
                checkPrompt.toLowerCase().matches("(?i)^(?:generate|create|draw|paint|render)\\s+(?:an?\\s+)?(?:image|picture|photo|artwork|illustration|drawing|portrait)\\b.*");

        if (isTextToImageModel(targetModelId) || ("auto".equalsIgnoreCase(requestedModelId) && isExplicitImagePrompt)) {
            String imageModelId = isTextToImageModel(targetModelId) ? targetModelId : "gemini-3.1-flash-image";
            return streamTextToImageSynthesis(conversationId, imageModelId, messages, attachments, startTime, allowFallback);
        }

        // Modality Validation: Check if request includes visual/image attachments
        boolean hasImageAttachment = false;
        if (attachments != null && !attachments.isEmpty()) {
            for (Map<String, Object> att : attachments) {
                String type = (String) att.get("type");
                String dataUrl = (String) att.get("dataUrl");
                if ((type != null && type.startsWith("image/")) || (dataUrl != null && dataUrl.startsWith("data:image/"))) {
                    hasImageAttachment = true;
                    break;
                }
            }
        }
        if (!hasImageAttachment && messages != null) {
            for (Map<String, Object> msg : messages) {
                Object content = msg.get("content");
                if (content instanceof List<?> parts) {
                    for (Object p : parts) {
                        if (p instanceof Map<?, ?> partMap && "image_url".equals(partMap.get("type"))) {
                            hasImageAttachment = true;
                            break;
                        }
                    }
                }
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> msgAtts = (List<Map<String, Object>>) msg.get("attachments");
                if (msgAtts != null) {
                    for (Map<String, Object> att : msgAtts) {
                        String type = (String) att.get("type");
                        String dataUrl = (String) att.get("dataUrl");
                        if ((type != null && type.startsWith("image/")) || (dataUrl != null && dataUrl.startsWith("data:image/"))) {
                            hasImageAttachment = true;
                            break;
                        }
                    }
                }
                if (hasImageAttachment) break;
            }
        }

        boolean switchedForVision = false;
        String originalRequested = targetModelId;
        if (hasImageAttachment) {
            String lowerId = targetModelId.toLowerCase();
            boolean isKnownVision = lowerId.contains("vision") || lowerId.contains("gemini") || lowerId.contains("image") || lowerId.contains("blip") || lowerId.contains("trocr") || lowerId.contains("vl") || lowerId.contains("moondream");
            if (!isKnownVision) {
                targetModelId = "gemini-2.5-flash-vision";
                switchedForVision = true;
                log.info("[Modality Validation] Image attachment detected with text-only model '{}'. Automatically switched to multimodal vision model '{}'.", originalRequested, targetModelId);
            }
        }

        final String finalTargetModelId = targetModelId;
        AiProvider provider = providerRegistry.resolveProvider(finalTargetModelId);

        String normLang = com.coderarmy.ragsupport.model.LanguageRegistry.normalizeCode(language);
        log.info("[Voice Diagnostic] streamInference called: convId='{}', model='{}', receivedLang='{}', normalizedLang='{}', provider='{}'",
                conversationId, finalTargetModelId, language, normLang, provider.getDisplayName());

        // 2. Extract current user prompt
        String lastUserPrompt = "";
        if (messages != null && !messages.isEmpty()) {
            for (int i = messages.size() - 1; i >= 0; i--) {
                Map<String, Object> m = messages.get(i);
                if ("user".equalsIgnoreCase((String) m.get("role"))) {
                    lastUserPrompt = (String) m.get("content");
                    break;
                }
            }
        }
        if (lastUserPrompt == null) lastUserPrompt = "";

        // 3. Persist user message to conversation history
        String convTitle = null;
        if (conversationId != null && !conversationId.isBlank()) {
            Conversation existingConv = conversationStorageService.getConversation(conversationId);
            if (existingConv != null) {
                convTitle = existingConv.getTitle();
            }
            if (!lastUserPrompt.isBlank() || (attachments != null && !attachments.isEmpty())) {
                String promptToStore = !lastUserPrompt.isBlank() ? lastUserPrompt : "Describe this image in detail.";
                conversationStorageService.appendMessage(conversationId, Map.of(
                        "id", "msg-" + System.currentTimeMillis() + "-user",
                        "role", "user",
                        "content", promptToStore,
                        "attachments", attachments != null ? attachments : Collections.emptyList(),
                        "language", normLang,
                        "createdAt", java.time.Instant.now().toString()
                ));
            }
        }

        // 4. Background Memory & Knowledge Graph Extraction: Extract persistent facts, stack, projects, decisions asynchronously
        final String promptForExtraction = lastUserPrompt;
        final String titleForExtraction = convTitle;
        if (userMemoryService != null && !promptForExtraction.isBlank()) {
            java.util.concurrent.CompletableFuture.runAsync(() -> {
                try {
                    userMemoryService.extractAndSaveMemoriesFromExchange(conversationId, titleForExtraction, promptForExtraction, null);
                } catch (Exception e) {
                    log.debug("[Inference Coordinator] Memory extraction skipped: {}", e.getMessage());
                }
            });
        }
        if (knowledgeExtractionPipeline != null && !lastUserPrompt.isBlank()) {
            try {
                knowledgeExtractionPipeline.extractFromExchangeAsync(conversationId, convTitle, lastUserPrompt, null);
            } catch (Exception e) {
                log.debug("[Inference Coordinator] Knowledge graph extraction skipped: {}", e.getMessage());
            }
        }

        // 5. Construct comprehensive research, memory, and anti-hallucination system prompt
        String baseSystem = (systemInstruction != null && !systemInstruction.isBlank())
                ? systemInstruction
                : "You are Yash AI — an elite, highly reliable, context-aware AI research assistant. Render clean Markdown, format code in syntax-highlighted blocks with language tags, and provide concise, accurate, verified answers.";

        StringBuilder systemContext = new StringBuilder();
        systemContext.append(baseSystem).append("\n\n");

        // Language Directive: Enforce direct native response generation in the target language
        if ("en".equals(normLang)) {
            systemContext.append("### 🌐 Target Response Language Directive (English):\n")
                    .append("Respond naturally in English while preserving technical accuracy, code, commands, and identifiers.\n\n");
        } else {
            java.util.Optional<com.coderarmy.ragsupport.model.LanguageRegistry.LanguageEntry> langOpt =
                    com.coderarmy.ragsupport.model.LanguageRegistry.findByCode(normLang);
            if (langOpt.isPresent()) {
                com.coderarmy.ragsupport.model.LanguageRegistry.LanguageEntry entry = langOpt.get();
                systemContext.append("### 🌐 Target Response Language Directive (")
                        .append(entry.getName()).append(" / ").append(entry.getNativeName()).append("):\n")
                        .append("Respond directly in natural ").append(entry.getName())
                        .append(" using standard ").append(entry.getScript()).append(" script. ")
                        .append("Formulate the entire answer natively and directly in ").append(entry.getName())
                        .append(" (").append(entry.getNativeName()).append("). ")
                        .append("Do NOT generate an English answer first and translate it. ")
                        .append("Preserve technical accuracy, programming languages, library names (e.g. React, Spring Boot, API, Java, Python), code blocks, commands, URLs, and identifiers intact. ")
                        .append("Do not reply in English unless the user explicitly requests English in their prompt.\n\n");
            } else {
                systemContext.append("### 🌐 Target Response Language Directive (English):\n")
                        .append("Respond naturally in English while preserving technical accuracy.\n\n");
            }
        }

        if (targetModelId.toLowerCase().contains("vision") || targetModelId.toLowerCase().contains("florence") ||
                targetModelId.toLowerCase().contains("vl") || targetModelId.toLowerCase().contains("moondream")) {
            systemContext.append("### 👁️ Image-to-Text Vision Model Active:\n")
                    .append("You are operating as a specialized Image-to-Text AI model specifically trained to understand visual inputs and generate detailed, accurate textual descriptions and answers.\n")
                    .append("- If an image is attached: Carefully analyze visual composition, key subjects, text/OCR, spatial relationships, and provide clear textual answers.\n")
                    .append("- If no image is attached: Provide a helpful answer and remind the user they can upload or attach an image using the paperclip button for comprehensive visual analysis.\n\n");
        }

        List<ServerSentEvent<String>> preludeEvents = new ArrayList<>();
        // Immediate start and thinking events to trigger State A on frontend without waiting
        preludeEvents.add(createSseEvent("start", Map.of(
                "requestId", effectiveReqId,
                "messageId", effectiveMsgId,
                "conversationId", conversationId != null ? conversationId : "",
                "modelId", targetModelId,
                "provider", provider.getDisplayName(),
                "timestamp", startTime
        )));
        preludeEvents.add(createSseEvent("thinking", Map.of(
                "requestId", effectiveReqId,
                "messageId", effectiveMsgId,
                "status", "thinking"
        )));

        if (switchedForVision) {
            preludeEvents.add(createSseEvent("model_switch", Map.of(
                    "originalModel", originalRequested,
                    "activeModel", targetModelId,
                    "reason", "Image attachment detected: automatically routed to multimodal vision model (" + targetModelId + ") for accurate visual understanding."
            )));
        }

        // A. Persistent User Memory Retrieval with Relevance & Hybrid Scoring
        List<UserMemory> relevantMemories = Collections.emptyList();
        if (userMemoryService != null && !lastUserPrompt.isBlank()) {
            relevantMemories = userMemoryService.findRelevantMemories(lastUserPrompt, 5);
            if (!relevantMemories.isEmpty()) {
                systemContext.append("### 🧠 Persistent Long-Term Memory (Across All Chats):\n");
                for (UserMemory m : relevantMemories) {
                    String statusLabel = (m.getStatus() != null && !m.getStatus().equalsIgnoreCase("ACTIVE"))
                            ? " [" + m.getStatus() + "]"
                            : "";
                    systemContext.append(String.format("- [%s]%s %s\n", m.getCategory(), statusLabel, m.getContent()));
                }
                systemContext.append("Directive: Actively honor and apply these established user preferences, tech stack, architectural decisions, and project goals across chats.\n\n");
            }
        }

        // B. Active Project Context & Continuation State
        Optional<ProjectContext> projectContext = Optional.empty();
        if (userMemoryService != null && !lastUserPrompt.isBlank()) {
            projectContext = userMemoryService.findRelevantProject(lastUserPrompt);
            if (projectContext.isPresent()) {
                ProjectContext p = projectContext.get();
                systemContext.append("### 🏗️ Active Project Context & Continuation State:\n");
                systemContext.append(String.format("- Project Name: %s\n", p.getName()));
                if (p.getTechStack() != null && !p.getTechStack().isBlank()) {
                    systemContext.append(String.format("- Tech Stack: %s\n", p.getTechStack()));
                }
                if (p.getArchitecture() != null && !p.getArchitecture().isBlank()) {
                    systemContext.append(String.format("- Architecture: %s\n", p.getArchitecture()));
                }
                if (p.getKeyFiles() != null && !p.getKeyFiles().isEmpty()) {
                    systemContext.append(String.format("- Key Project Files: %s\n", String.join(", ", p.getKeyFiles())));
                }
                if (p.getCompletedTasks() != null && !p.getCompletedTasks().isEmpty()) {
                    systemContext.append(String.format("- Completed Tasks: %s\n", String.join("; ", p.getCompletedTasks())));
                }
                if (p.getUnresolvedTasks() != null && !p.getUnresolvedTasks().isEmpty()) {
                    systemContext.append(String.format("- Remaining / Unresolved Tasks: %s\n", String.join("; ", p.getUnresolvedTasks())));
                }
                if (p.getLastKnownState() != null && !p.getLastKnownState().isBlank()) {
                    systemContext.append(String.format("- Last Known State: %s\n", p.getLastKnownState()));
                }
                systemContext.append("Directive: When continuing unfinished work, resume directly from the last known state. Do NOT repeat already completed steps or re-suggest failed solutions without explanation.\n\n");
            }
        }

        // C. Relevant Excerpts from Past Conversations
        List<PastConversationExcerpt> pastExcerpts = Collections.emptyList();
        if (conversationStorageService != null && !lastUserPrompt.isBlank()) {
            pastExcerpts = conversationStorageService.findRelevantPastConversations(conversationId, lastUserPrompt, 3);
            if (!pastExcerpts.isEmpty()) {
                systemContext.append("### 📜 Relevant Excerpts from Past Conversations:\n");
                for (PastConversationExcerpt ex : pastExcerpts) {
                    systemContext.append(String.format("- [From Past Chat: \"%s\"]\n", ex.getConversationTitle()));
                    if (ex.getUserQuery() != null && !ex.getUserQuery().isBlank()) {
                        systemContext.append(String.format("  User asked: %s\n", ex.getUserQuery()));
                    }
                    systemContext.append(String.format("  Previous Context / Code: %s\n", ex.getAssistantExcerpt()));
                }
                systemContext.append("Directive: Use these verified past exchanges to maintain context continuity, recall exact code, commands, or troubleshooting steps from previous sessions.\n\n");
            }
        }

        // D. Memory & Continuity Integrity Directives
        if (!relevantMemories.isEmpty() || projectContext.isPresent() || !pastExcerpts.isEmpty()) {
            systemContext.append("### 🛡️ Memory & History Integrity Directives:\n")
                    .append("1. Strict Recall: Never claim the user said something, agreed to something, or wrote specific code unless it appears in the persistent memory, project context, or past conversation excerpts above.\n")
                    .append("2. Acknowledge Missing Context: If previous context, code, or details cannot be found in stored memory, state what is missing and ask a concise clarifying question rather than guessing.\n")
                    .append("3. Status Transitions: Strictly respect `[RESOLVED]` and `[COMPLETED]` tags — do not treat solved errors as currently active issues.\n\n");

            Map<String, Object> memoryEventData = new LinkedHashMap<>();
            memoryEventData.put("count", relevantMemories.size());
            memoryEventData.put("memories", relevantMemories.stream().map(UserMemory::getContent).collect(Collectors.toList()));
            if (projectContext.isPresent()) {
                memoryEventData.put("project", projectContext.get().getName());
            }
            if (!pastExcerpts.isEmpty()) {
                memoryEventData.put("pastExcerptsCount", pastExcerpts.size());
            }
            preludeEvents.add(createSseEvent("memory", memoryEventData));
        }

        // E. Pinecone Knowledge Base Context
        if (lastUserPrompt.toLowerCase().matches(".*(refund|return|shipping|policy|payment|order|exchange).*")) {
            systemContext.append("[Pinecone Knowledge Base Context (Index: shop-support)]: Official Store Policy allows 30-day hassle-free returns and refunds within 3-5 business days.\n\n");
        }

        // F. Document Intelligence & Scoped Conversation RAG
        List<Map<String, Object>> effectiveAttachments = new ArrayList<>();
        if (attachments != null) effectiveAttachments.addAll(attachments);
        if (messages != null) {
            for (Map<String, Object> m : messages) {
                if (m.get("attachments") instanceof List<?> list) {
                    for (Object item : list) {
                        if (item instanceof Map<?, ?> map) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> casted = (Map<String, Object>) map;
                            effectiveAttachments.add(casted);
                        }
                    }
                }
            }
        }

        if (documentIntelligenceService != null) {
            // Index newly attached documents in messages if not already indexed
            for (Map<String, Object> att : effectiveAttachments) {
                String attName = (String) att.get("name");
                String attType = (String) att.get("type");
                String dataUrl = (String) att.get("dataUrl");
                if (attName != null && attName.toLowerCase().matches(".*\\.(pdf|docx|xlsx|xls|csv|txt|md)$") && dataUrl != null && dataUrl.startsWith("data:")) {
                    try {
                        int commaIdx = dataUrl.indexOf(',');
                        if (commaIdx > 0) {
                            byte[] docBytes = Base64.getDecoder().decode(dataUrl.substring(commaIdx + 1));
                            documentIntelligenceService.extractAndIndex(conversationId, attName, attType, docBytes);
                        }
                    } catch (Exception docEx) {
                        log.warn("[Inference Coordinator] Could not index attached document '{}': {}", attName, docEx.getMessage());
                    }
                }
            }

            if (documentIntelligenceService.hasDocuments(conversationId)) {
                String docContext = documentIntelligenceService.buildDocumentContext(conversationId, lastUserPrompt, 5);
                if (!docContext.isBlank()) {
                    systemContext.append(docContext).append("\n");
                    List<com.coderarmy.ragsupport.model.DocumentExtractionResult> docs = documentIntelligenceService.getDocuments(conversationId);
                    preludeEvents.add(createSseEvent("document", Map.of(
                            "count", docs.size(),
                            "documents", docs.stream().map(com.coderarmy.ragsupport.model.DocumentExtractionResult::getFileName).toList()
                    )));
                }
            }
        }

        // G. Live Web Research, Fact Verification & Anti-Hallucination Directives
        boolean hasDocs = (documentIntelligenceService != null && documentIntelligenceService.hasDocuments(conversationId));
        boolean shouldSearchWeb = Boolean.TRUE.equals(webSearchOverride) ||
                (!hasDocs && factVerificationService != null && factVerificationService.requiresWebSearch(lastUserPrompt, effectiveAttachments, webSearchOverride));

        ResearchVerificationResult verification = null;
        if (shouldSearchWeb && factVerificationService != null) {
            verification = factVerificationService.verifyAndCollectEvidence(lastUserPrompt);

            if (verification != null && verification.isSourcesFound()) {
                systemContext.append(verification.getEvidenceBrief()).append("\n");
                systemContext.append("### 🛡️ Strict Verification & Citation Directives:\n")
                        .append("1. Evidence-Based Answering: Base all factual claims strictly on the verified sources provided above.\n")
                        .append("2. Clickable Inline Citations: Next to every factual statement, insert a clickable markdown citation, e.g. [1](URL), [2](URL).\n")
                        .append("3. Verified Sources List: At the end of the answer, always include a dedicated section titled '### 🌐 Verified Sources & Citations' with the titles and exact URLs from the retrieved evidence. NEVER invent or hallucinate URLs.\n")
                        .append("4. Strong Anti-Hallucination Rule: Never invent people, companies, products, APIs, features, events, papers, statistics, or facts. If something is unknown or not supported by the evidence, state clearly what cannot be confirmed.\n")
                        .append("5. Disagreements: If sources disagree or present conflicting dates/claims, clearly explain the disagreement and note what remains uncertain.\n\n");

                if (!verification.isEntityVerified()) {
                    systemContext.append("### ⚠️ Non-Existent or Ambiguous Entity Warning:\n")
                            .append("The specific entity, product, company, or claim in this query could not be verified in credible external sources.\n")
                            .append("Strict Anti-Hallucination Directive: Do NOT assume this entity exists. Never invent people, products, specifications, release dates, or features. Explicitly state that you could not confirm its existence and ask a concise, targeted clarifying question.\n\n");
                }

                Map<String, Object> researchData = new LinkedHashMap<>();
                researchData.put("query", lastUserPrompt);
                researchData.put("verified", verification.isEntityVerified());
                researchData.put("sourcesCount", verification.getSources().size());
                researchData.put("sources", verification.getSources());
                if (!verification.isEntityVerified()) {
                    researchData.put("warning", "Could not verify the existence of this entity or claim in credible sources.");
                }

                preludeEvents.add(createSseEvent("research", researchData));
            } else if (verification != null && !verification.isSourcesFound()) {
                systemContext.append("### ⚠️ Live Web Verification Notice:\n")
                        .append("Live internet research could not independently verify this query because the search provider returned no credible sources.\n")
                        .append("Strict Directive: Explicitly communicate that independent verification could not be confirmed. Ask a relevant clarifying question instead of guessing.\n\n");

                preludeEvents.add(createSseEvent("research", Map.of(
                        "query", lastUserPrompt,
                        "verified", false,
                        "sourcesCount", 0,
                        "warning", verification.getWarningNotice()
                )));
            }
        }

        // Final reinforcement language directive at the very end of system context to guarantee compliance
        if (!"en".equals(normLang)) {
            java.util.Optional<com.coderarmy.ragsupport.model.LanguageRegistry.LanguageEntry> langOpt =
                    com.coderarmy.ragsupport.model.LanguageRegistry.findByCode(normLang);
            if (langOpt.isPresent()) {
                com.coderarmy.ragsupport.model.LanguageRegistry.LanguageEntry entry = langOpt.get();
                systemContext.append("### ⚠️ CRITICAL LANGUAGE INSTRUCTION (STRICT COMPLIANCE REQUIRED):\n")
                        .append("You MUST formulate and write your entire response natively in ").append(entry.getName())
                        .append(" (").append(entry.getNativeName()).append(") using standard ")
                        .append(entry.getScript()).append(" script.\n")
                        .append("Even though the user question, previous conversation, memories, or evidence above are written in English, ")
                        .append("do NOT generate an English answer. Formulate your entire answer directly in ").append(entry.getName())
                        .append(" (").append(entry.getNativeName()).append("). Only code syntax, library names (e.g. React, Spring Boot, API, Java), and technical identifiers stay in their original form.\n\n");
            }
        }

        // 6. Build standardized chat message list (supporting multimodal image parts)
        List<Map<String, Object>> chatMessages = new ArrayList<>();
        chatMessages.add(Map.of("role", "system", "content", systemContext.toString().trim()));

        if (messages != null) {
            for (int i = 0; i < messages.size(); i++) {
                Map<String, Object> m = messages.get(i);
                String role = (String) m.get("role");
                String content = (String) m.get("content");
                if (content == null) content = "";

                if ("user".equalsIgnoreCase(role)) {
                    boolean isLatestUserMsg = (i == messages.size() - 1 ||
                            (i == messages.size() - 2 && "assistant".equalsIgnoreCase((String) messages.get(messages.size() - 1).get("role"))));

                    // For the latest user prompt, enforce target language prompt prefix
                    if (isLatestUserMsg && !"en".equals(normLang) && !content.isBlank()) {
                        java.util.Optional<com.coderarmy.ragsupport.model.LanguageRegistry.LanguageEntry> langOpt =
                                com.coderarmy.ragsupport.model.LanguageRegistry.findByCode(normLang);
                        if (langOpt.isPresent()) {
                            com.coderarmy.ragsupport.model.LanguageRegistry.LanguageEntry entry = langOpt.get();
                            content = "[Respond completely in " + entry.getName() + " (" + entry.getNativeName() + ") using " + entry.getScript() + " script]\n\n" + content;
                        }
                    }

                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> msgAtts = (List<Map<String, Object>>) m.get("attachments");
                    List<Map<String, Object>> candidateAtts = (msgAtts != null && !msgAtts.isEmpty())
                            ? msgAtts
                            : (isLatestUserMsg && attachments != null ? attachments : Collections.emptyList());

                    List<Map<String, Object>> imageAtts = candidateAtts.stream()
                            .filter(a -> {
                                String type = (String) a.get("type");
                                String dataUrl = (String) a.get("dataUrl");
                                return (type != null && type.startsWith("image/")) || (dataUrl != null && dataUrl.startsWith("data:image/"));
                            })
                            .toList();

                    if (!imageAtts.isEmpty()) {
                        List<Map<String, Object>> contentParts = new ArrayList<>();
                        String promptPart = content.isBlank() ? "Analyze this image and generate a detailed text response." : content;
                        contentParts.add(Map.of("type", "text", "text", promptPart));
                        for (Map<String, Object> img : imageAtts) {
                            String url = (String) img.get("dataUrl");
                            if (url != null && !url.isBlank()) {
                                contentParts.add(Map.of("type", "image_url", "image_url", Map.of("url", url)));
                            }
                        }
                        chatMessages.add(Map.of("role", "user", "content", contentParts));
                    } else if (!content.isBlank()) {
                        chatMessages.add(Map.of("role", "user", "content", content));
                    }
                } else if ("assistant".equalsIgnoreCase(role)) {
                    if (!content.isBlank()) {
                        chatMessages.add(Map.of("role", "assistant", "content", content));
                    }
                }
            }
        }

        // 7. Stream inference from the designated provider, prepending any research/memory metadata SSE events
        Flux<ServerSentEvent<String>> providerStream = provider.streamChat(finalTargetModelId, chatMessages, startTime, conversationId, effectiveReqId, effectiveMsgId);

        // Enrich metadata with explicit language and update stored conversation message upon completion
        providerStream = providerStream.map(sse -> {
            if ("metadata".equals(sse.event()) && sse.data() != null) {
                try {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> metaMap = objectMapper.readValue(sse.data(), Map.class);
                    Map<String, Object> enriched = new LinkedHashMap<>(metaMap);
                    enriched.put("language", normLang);
                    return createSseEvent("metadata", enriched);
                } catch (Exception ignored) {}
            }
            return sse;
        }).doOnComplete(() -> {
            log.info("[Voice Diagnostic] LLM stream completed: convId='{}', lang='{}', model='{}'",
                    conversationId, normLang, finalTargetModelId);
            if (conversationId != null && !conversationId.isBlank()) {
                try {
                    conversationStorageService.updateLastMessageLanguage(conversationId, normLang);
                } catch (Exception e) {
                    log.debug("[Voice Diagnostic] Could not update stored message language: {}", e.getMessage());
                }
            }
        });

        if (!preludeEvents.isEmpty()) {
            return Flux.fromIterable(preludeEvents).concatWith(providerStream);
        }

        return providerStream;
    }

    public boolean isTextToImageModel(String modelId) {
        if (modelId == null) return false;
        String lower = modelId.toLowerCase();
        return lower.contains("flux") ||
                lower.contains("stable-diffusion") ||
                lower.contains("sdxl") ||
                lower.contains("banana") ||
                lower.contains("flash-image") ||
                lower.contains("pro-image") ||
                lower.contains("gpt-image") ||
                lower.contains("flare") ||
                lower.contains("sunburst") ||
                lower.equals("flux-schnell-free") ||
                lower.contains("text-to-image");
    }

    private Flux<ServerSentEvent<String>> streamTextToImageSynthesis(
            String conversationId,
            String targetModelId,
            List<Map<String, Object>> messages,
            List<Map<String, Object>> attachments,
            long startTime,
            Boolean allowFallback
    ) {
        String prompt = "";
        if (messages != null && !messages.isEmpty()) {
            for (int i = messages.size() - 1; i >= 0; i--) {
                Map<String, Object> m = messages.get(i);
                if ("user".equalsIgnoreCase((String) m.get("role"))) {
                    prompt = (String) m.get("content");
                    break;
                }
            }
        }
        if (prompt == null || prompt.isBlank()) {
            return Flux.just(
                    createSseEvent("error", Map.of("error", "⚠️ Prompt cannot be empty. Please enter an image description to generate.")),
                    createSseEvent("done", Map.of("status", "failed"))
            );
        }
        final String effectivePrompt = prompt.trim();

        // Extract reference images from attachments if user provided reference image
        List<String> refImages = new ArrayList<>();
        if (attachments != null) {
            for (Map<String, Object> att : attachments) {
                String dataUrl = (String) att.get("dataUrl");
                if (dataUrl != null && dataUrl.startsWith("data:image/")) {
                    refImages.add(dataUrl);
                }
            }
        }
        if (refImages.isEmpty() && messages != null) {
            for (Map<String, Object> m : messages) {
                if ("user".equalsIgnoreCase((String) m.get("role")) && m.get("attachments") instanceof List<?> list) {
                    for (Object item : list) {
                        if (item instanceof Map<?, ?> map) {
                            String dataUrl = (String) map.get("dataUrl");
                            if (dataUrl != null && dataUrl.startsWith("data:image/")) {
                                refImages.add(dataUrl);
                            }
                        }
                    }
                }
            }
        }

        // Detect requested aspect ratio from prompt keywords
        String pLower = effectivePrompt.toLowerCase();
        int reqWidth = 1024;
        int reqHeight = 1024;
        String reqAspect = "1:1";

        if (pLower.contains("16:9") || pLower.contains("landscape") || pLower.contains("wide-angle") || pLower.contains("wallpaper") || pLower.contains("widescreen")) {
            reqWidth = 1024;
            reqHeight = 576;
            reqAspect = "16:9";
        } else if (pLower.contains("9:16") || pLower.contains("portrait") || pLower.contains("vertical") || pLower.contains("story")) {
            reqWidth = 576;
            reqHeight = 1024;
            reqAspect = "9:16";
        } else if (pLower.contains("4:3")) {
            reqWidth = 768;
            reqHeight = 576;
            reqAspect = "4:3";
        }

        final int finalWidth = reqWidth;
        final int finalHeight = reqHeight;
        final String finalAspect = reqAspect;
        final List<String> finalRefImages = refImages;

        if (conversationId != null && !conversationId.isBlank()) {
            conversationStorageService.appendMessage(conversationId, Map.of(
                    "id", "msg-" + System.currentTimeMillis() + "-user",
                    "role", "user",
                    "content", effectivePrompt,
                    "attachments", attachments != null ? attachments : Collections.emptyList(),
                    "createdAt", java.time.Instant.now().toString()
            ));
        }

        return Flux.defer(() -> {
            List<ServerSentEvent<String>> events = new ArrayList<>();

            events.add(createSseEvent("thinking", Map.of(
                    "message", "Understanding your prompt & analyzing constraints...",
                    "modelId", targetModelId
            )));

            TextToImageService service = this.textToImageService;
            if (service == null) {
                service = new TextToImageService(new HubRegistryService());
            }

            ImageGenerationRequest req = new ImageGenerationRequest();
            req.setModelId(targetModelId);
            req.setPrompt(effectivePrompt);
            req.setWidth(finalWidth);
            req.setHeight(finalHeight);
            req.setAspectRatio(finalAspect);
            req.setAllowFallback(Boolean.TRUE.equals(allowFallback));
            if (!finalRefImages.isEmpty()) {
                req.setReferenceImages(finalRefImages);
                req.setEditMode("edit");
            }

            events.add(createSseEvent("status", Map.of(
                    "step", "synthesizing",
                    "message", "Synthesizing high-fidelity image with " + targetModelId + "...",
                    "modelId", targetModelId
            )));

            ImageGenerationResponse response = service.generateImage(req);
            long totalDuration = System.currentTimeMillis() - startTime;

            if ("SUCCESS".equalsIgnoreCase(response.getStatus()) && response.getImageDataUrl() != null) {
                double durationSec = response.getDurationMs() > 0 ? (response.getDurationMs() / 1000.0) : (totalDuration / 1000.0);
                String formattedDuration = String.format("%.2f", durationSec);
                String actualModelDisplayName = response.getActualModelName() != null ? response.getActualModelName() : response.getModelName();

                // Notify if failover occurred
                if (response.getFallbackFrom() != null) {
                    events.add(createSseEvent("model_switch", Map.of(
                            "originalModel", response.getFallbackFrom(),
                            "activeModel", response.getModelId(),
                            "actualModelName", actualModelDisplayName,
                            "reason", response.getFallbackReason() != null ? response.getFallbackReason() : "Failover to free diffusion engine"
                    )));
                }

                String intro = "Here is your generated image synthesized by **" + actualModelDisplayName + "**:\n\n";
                String imgMarkdown = "![" + response.getPrompt() + "](" + response.getImageDataUrl() + ")\n\n";
                String metaMarkdown = "*Prompt:* \"" + response.getPrompt() + "\" • *Model:* " + actualModelDisplayName + " • *Generation Time:* " + formattedDuration + "s";
                if (response.getFallbackFrom() != null) {
                    metaMarkdown += " • *(Switched from " + response.getFallbackFrom() + ")*";
                }
                String fullAnswer = intro + imgMarkdown + metaMarkdown;

                Map<String, Object> imgMeta = new LinkedHashMap<>();
                imgMeta.put("id", response.getId() != null ? response.getId() : "img-" + System.currentTimeMillis());
                imgMeta.put("modelId", response.getModelId());
                imgMeta.put("modelName", actualModelDisplayName);
                imgMeta.put("provider", response.getProvider());
                imgMeta.put("prompt", response.getPrompt());
                imgMeta.put("originalPrompt", response.getOriginalPrompt());
                imgMeta.put("enhancedPrompt", response.getEnhancedPrompt());
                imgMeta.put("imageDataUrl", response.getImageDataUrl());
                imgMeta.put("width", response.getWidth());
                imgMeta.put("height", response.getHeight());
                imgMeta.put("aspectRatio", response.getAspectRatio());
                imgMeta.put("durationMs", response.getDurationMs());
                if (response.getFallbackFrom() != null) {
                    imgMeta.put("fallbackFrom", response.getFallbackFrom());
                    imgMeta.put("fallbackReason", response.getFallbackReason());
                }
                if (response.getStructuredSpec() != null) {
                    imgMeta.put("structuredSpec", response.getStructuredSpec());
                }

                if (conversationId != null && !conversationId.isBlank()) {
                    conversationStorageService.appendMessage(conversationId, Map.of(
                            "id", "msg-" + System.currentTimeMillis() + "-assistant",
                            "role", "assistant",
                            "content", fullAnswer,
                            "generatedImage", imgMeta,
                            "createdAt", java.time.Instant.now().toString()
                    ));
                }

                events.add(createSseEvent("image", imgMeta));
                events.add(createSseEvent("token", Map.of("content", intro)));
                events.add(createSseEvent("token", Map.of("content", imgMarkdown)));
                events.add(createSseEvent("token", Map.of("content", metaMarkdown)));

                events.add(createSseEvent("metadata", Map.of(
                        "modelId", response.getModelId(),
                        "modelName", actualModelDisplayName,
                        "provider", response.getProvider(),
                        "durationMs", response.getDurationMs()
                )));

                events.add(createSseEvent("done", Map.of("status", "complete")));
            } else {
                String rawErr = response.getError() != null ? response.getError() : "Image synthesis failed";
                String userFacingErr;

                if (rawErr.contains("429") || "QUOTA_EXCEEDED".equals(response.getErrorCategory())) {
                    userFacingErr = "⚠️ **Model Quota Notice (HTTP 429)**:\n" +
                            rawErr + "\n\n" +
                            "💡 **Actions Available:**\n" +
                            "- Click **[Try with Free Diffusion (FLUX / Sana)]** below to generate with the zero-cost hosted model.\n" +
                            "- Or switch models using the Model Selector.";
                } else if (!"flux-schnell-free".equalsIgnoreCase(targetModelId) && (rawErr.contains("402") || "PAYMENT_REQUIRED".equals(response.getErrorCategory()))) {
                    userFacingErr = "⚠️ **Inference Notice (HTTP 402 Payment Required)**:\n" +
                            "Account credits or billing setup required for model `" + targetModelId + "`.\n\n" +
                            "💡 **Solution:** Click **[Try with Free Diffusion (FLUX / Sana)]** or switch to a free model.";
                } else {
                    userFacingErr = "⚠️ **Image Generation Notice**: " + rawErr;
                }

                Map<String, Object> errorMsgMap = new LinkedHashMap<>();
                errorMsgMap.put("id", "msg-" + System.currentTimeMillis() + "-assistant");
                errorMsgMap.put("role", "assistant");
                errorMsgMap.put("content", userFacingErr);
                errorMsgMap.put("error", userFacingErr);
                errorMsgMap.put("errorCategory", response.getErrorCategory() != null ? response.getErrorCategory() : "PROVIDER_ERROR");
                errorMsgMap.put("errorReason", response.getErrorReason());
                errorMsgMap.put("errorNextStep", response.getErrorNextStep());
                errorMsgMap.put("docUrl", response.getDocUrl());
                errorMsgMap.put("canRetry", response.isCanRetry());
                errorMsgMap.put("cooldownSeconds", response.getCooldownSeconds());
                errorMsgMap.put("canFallback", response.isCanFallback());
                errorMsgMap.put("fallbackModelId", response.getFallbackModelId() != null ? response.getFallbackModelId() : "flux-schnell-free");
                errorMsgMap.put("fallbackModelName", response.getFallbackModelName() != null ? response.getFallbackModelName() : "FLUX.1 [schnell] / Sana (Free Tier Hosted)");
                errorMsgMap.put("failedModelId", targetModelId);
                errorMsgMap.put("failedProvider", response.getProvider());
                errorMsgMap.put("originalPrompt", effectivePrompt);
                errorMsgMap.put("structuredSpec", response.getStructuredSpec());
                errorMsgMap.put("createdAt", java.time.Instant.now().toString());

                if (conversationId != null && !conversationId.isBlank()) {
                    conversationStorageService.appendMessage(conversationId, errorMsgMap);
                }

                events.add(createSseEvent("token", Map.of("content", userFacingErr)));
                events.add(createSseEvent("error", errorMsgMap));
                events.add(createSseEvent("done", Map.of("status", "complete")));
            }

            return Flux.fromIterable(events);
        }).subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic());
    }
}
