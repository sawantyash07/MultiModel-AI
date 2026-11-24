package com.coderarmy.ragsupport.service.provider;

import com.coderarmy.ragsupport.service.ConversationStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * Google Gemini Provider using Google's official OpenAI-compatible chat completions endpoint.
 * Provides generous free-tier hosted inference without requiring paid subscriptions.
 */
@Component
public class GeminiProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiProvider.class);

    @Value("${gemini.api-key:}")
    private String configuredApiKey;

    @Value("${gemini.endpoint:https://generativelanguage.googleapis.com/v1beta/openai/chat/completions}")
    private String endpoint;

    @Value("${groq.fallback-enabled:true}")
    private boolean fallbackEnabled = true;

    private final ConversationStorageService conversationStorageService;
    private final GroqProvider groqProvider;
    @Autowired(required = false)
    private com.coderarmy.ragsupport.service.StreamCancellationRegistry cancellationRegistry;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Autowired
    public GeminiProvider(ConversationStorageService conversationStorageService, @Autowired(required = false) GroqProvider groqProvider) {
        this.conversationStorageService = conversationStorageService;
        this.groqProvider = groqProvider;
    }

    public GeminiProvider(ConversationStorageService conversationStorageService, GroqProvider groqProvider, com.coderarmy.ragsupport.service.StreamCancellationRegistry cancellationRegistry) {
        this.conversationStorageService = conversationStorageService;
        this.groqProvider = groqProvider;
        this.cancellationRegistry = cancellationRegistry;
    }

    public GeminiProvider(ConversationStorageService conversationStorageService) {
        this(conversationStorageService, null);
    }

    public String getEffectiveApiKey() {
        String envKey = System.getenv("GEMINI_API_KEY");
        if (envKey != null && !envKey.isBlank()) {
            return envKey.trim();
        }
        if (configuredApiKey != null && !configuredApiKey.isBlank() && !configuredApiKey.startsWith("${")) {
            return configuredApiKey.trim();
        }
        return null;
    }

    @Override
    public String getProviderId() {
        return "gemini";
    }

    @Override
    public String getDisplayName() {
        return "Google Gemini (Free Hosted)";
    }

    @Override
    public boolean isConfigured() {
        String key = getEffectiveApiKey();
        return key != null && !key.isBlank();
    }

    @Override
    public boolean isAvailable() {
        return isConfigured();
    }

    @Override
    public String getStatusDescription() {
        return isConfigured() ? "Active (Free-Tier Hosted)" : "Missing GEMINI_API_KEY";
    }

    @Override
    public boolean supportsModel(String modelId) {
        if (modelId == null) return false;
        String m = modelId.toLowerCase();
        return m.startsWith("gemini") ||
               m.contains("flash") ||
               m.contains("vision") ||
               m.contains("image") ||
               m.contains("blip") ||
               m.contains("vit-gpt2") ||
               m.contains("trocr") ||
               m.contains("git") ||
               m.contains("glm") ||
               m.contains("caption") ||
               m.contains("ocr") ||
               m.contains("florence") ||
               m.contains("moondream") ||
               m.contains("vl") ||
               m.contains("pollinations");
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

    @Override
    public Flux<ServerSentEvent<String>> streamChat(
            String modelId,
            List<Map<String, Object>> messages,
            long startTime,
            String conversationId
    ) {
        String reqId = "req-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
        String msgId = "msg-" + System.currentTimeMillis() + "-assistant";
        return streamChat(modelId, messages, startTime, conversationId, reqId, msgId);
    }

    @Override
    public Flux<ServerSentEvent<String>> streamChat(
            String modelId,
            List<Map<String, Object>> messages,
            long startTime,
            String conversationId,
            String requestId,
            String messageId
    ) {
        final String effectiveReqId = (requestId != null && !requestId.isBlank())
                ? requestId
                : ("req-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6));
        final String effectiveMsgId = (messageId != null && !messageId.isBlank())
                ? messageId
                : ("msg-" + System.currentTimeMillis() + "-assistant");

        String apiKey = getEffectiveApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            log.error("[Gemini Provider] Missing GEMINI_API_KEY");
            return Flux.just(
                    createSseEvent("error", Map.of(
                            "error", "Google Gemini Authentication Error (HTTP 401): The GEMINI_API_KEY environment variable is not configured. Please set the GEMINI_API_KEY environment variable to use the free-tier hosted Gemini provider.",
                            "statusCode", 401,
                            "provider", getDisplayName(),
                            "modelId", modelId,
                            "requestId", effectiveReqId,
                            "messageId", effectiveMsgId
                    )),
                    createSseEvent("done", Map.of("status", "error", "requestId", effectiveReqId, "messageId", effectiveMsgId))
            );
        }

        final boolean hasImage = hasImageContent(messages);
        final List<String> candidateModels = buildModelFallbackChain(modelId, hasImage);
        final String initialTargetModel = candidateModels.get(0);
        log.info("[Gemini Provider] Streaming chat for model '{}' (primary: '{}', hasImage: {}, reqId: '{}') via endpoint '{}'",
                modelId, initialTargetModel, hasImage, effectiveReqId, endpoint);

        return Flux.<ServerSentEvent<String>>create(sink -> {
            final java.util.concurrent.atomic.AtomicBoolean isCancelled = new java.util.concurrent.atomic.AtomicBoolean(false);
            final java.util.concurrent.atomic.AtomicReference<BufferedReader> activeReaderRef = new java.util.concurrent.atomic.AtomicReference<>(null);

            Runnable cancelHook = () -> {
                isCancelled.set(true);
                BufferedReader r = activeReaderRef.get();
                if (r != null) {
                    try { r.close(); } catch (Exception ignored) {}
                }
            };

            sink.onCancel(cancelHook::run);
            if (cancellationRegistry != null) {
                cancellationRegistry.register(effectiveReqId, cancelHook);
            }

            try {
                List<Map<String, Object>> effectiveMessages = new ArrayList<>(messages);
                if (modelId != null) {
                    String lowerId = modelId.toLowerCase();
                    if (lowerId.contains("blip") || lowerId.contains("vit-gpt2")) {
                        effectiveMessages.add(0, Map.of(
                                "role", "system",
                                "content", "You are an expert image-to-text vision model (BLIP/ViT-GPT2). Generate clear, accurate natural language descriptions and detailed captions of the given image."
                        ));
                    } else if (lowerId.contains("trocr") || lowerId.contains("glm-ocr")) {
                        effectiveMessages.add(0, Map.of(
                                "role", "system",
                                "content", "You are a specialized Image-to-Text OCR model (TrOCR/GLM-OCR). Accurately transcribe and extract all visible text, numbers, formulas, and formatting from the image."
                        ));
                    } else if (lowerId.contains("git-base")) {
                        effectiveMessages.add(0, Map.of(
                                "role", "system",
                                "content", "You are Microsoft GIT (Generative Image-to-text Transformer). Describe the visual objects, attributes, and text in the image in response to user queries."
                        ));
                    }
                }

                HttpResponse<java.io.InputStream> response = null;
                int statusCode = 0;
                String activeTargetModel = initialTargetModel;

                for (String candidate : candidateModels) {
                    if (isCancelled.get() || sink.isCancelled()) break;
                    activeTargetModel = candidate;
                    Map<String, Object> requestBody = Map.of(
                            "model", candidate,
                            "messages", effectiveMessages,
                            "stream", true,
                            "max_tokens", 2048,
                            "temperature", 0.7
                    );

                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(endpoint))
                            .header("Authorization", "Bearer " + apiKey)
                            .header("Content-Type", "application/json")
                            .header("User-Agent", "YashAI-Chat/1.0")
                            .timeout(Duration.ofSeconds(60))
                            .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                            .build();

                    response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
                    statusCode = response.statusCode();

                    if (statusCode == 200) {
                        break;
                    }

                    if (statusCode == 429 || statusCode == 503) {
                        log.warn("[Gemini Provider] HTTP {} on model '{}'. Attempting next candidate in fallback chain...", statusCode, candidate);
                        continue;
                    } else {
                        break;
                    }
                }

                if (isCancelled.get() || sink.isCancelled()) {
                    log.info("[Gemini Provider] Generation cancelled before response: reqId='{}'", effectiveReqId);
                    sink.next(createSseEvent("cancelled", Map.of("status", "cancelled", "requestId", effectiveReqId, "messageId", effectiveMsgId)));
                    sink.complete();
                    return;
                }

                if (statusCode != 200) {
                    if (statusCode == 429 && !hasImage && fallbackEnabled && groqProvider != null && groqProvider.isConfigured()) {
                        log.warn("[Gemini Provider] HTTP 429 Rate Limit encountered on Google Gemini for text query. Automatically falling back to Groq high-speed provider without duplicate retries...");
                        groqProvider.streamChatAsFallback("qwen/qwen3.8-27b", messages, startTime, conversationId, effectiveReqId, effectiveMsgId)
                                .subscribe(
                                        sink::next,
                                        sink::error,
                                        sink::complete
                                );
                        return;
                    }

                    String rawError = "";
                    if (response != null && response.body() != null) {
                        try (BufferedReader errReader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                            StringBuilder sb = new StringBuilder();
                            String l;
                            while ((l = errReader.readLine()) != null) {
                                sb.append(l).append("\n");
                            }
                            rawError = sb.toString().trim();
                        }
                    }

                    String friendlyMsg = formatErrorMessage(statusCode, rawError, activeTargetModel);
                    log.error("[Gemini Provider Error] Status: {}, Detail: {}", statusCode, friendlyMsg);

                    sink.next(createSseEvent("error", Map.of(
                            "error", friendlyMsg,
                            "statusCode", statusCode,
                            "provider", getDisplayName(),
                            "modelId", activeTargetModel,
                            "requestId", effectiveReqId,
                            "messageId", effectiveMsgId
                    )));
                    sink.next(createSseEvent("done", Map.of("status", "error", "requestId", effectiveReqId, "messageId", effectiveMsgId)));
                    sink.complete();
                    return;
                }

                StringBuilder fullResponse = new StringBuilder();
                long firstTokenTimeMs = -1;
                int tokenCount = 0;

                try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                    activeReaderRef.set(reader);
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (isCancelled.get() || sink.isCancelled()) {
                            log.info("[Gemini Provider] Stream cancelled mid-stream by client: convId={}, reqId={}", conversationId, effectiveReqId);
                            break;
                        }

                        String trimmed = line.trim();
                        if (trimmed.isEmpty()) continue;

                        if (trimmed.equals("data: [DONE]")) {
                            break;
                        }

                        if (trimmed.startsWith("data: ")) {
                            String dataPayload = trimmed.substring(6).trim();
                            if (dataPayload.equals("[DONE]")) break;

                            try {
                                JsonNode node = objectMapper.readTree(dataPayload);
                                JsonNode choices = node.path("choices");
                                if (choices.isArray() && choices.size() > 0) {
                                    JsonNode choice = choices.get(0);
                                    String chunk = "";
                                    if (choice.has("delta") && choice.path("delta").has("content")) {
                                        chunk = choice.path("delta").path("content").asText("");
                                    } else if (choice.has("message") && choice.path("message").has("content")) {
                                        chunk = choice.path("message").path("content").asText("");
                                    }
                                    if (!chunk.isEmpty()) {
                                        if (firstTokenTimeMs < 0) {
                                            firstTokenTimeMs = System.currentTimeMillis() - startTime;
                                        }
                                        tokenCount++;
                                        fullResponse.append(chunk);

                                        Map<String, Object> tokenPayload = new LinkedHashMap<>();
                                        tokenPayload.put("content", chunk);
                                        tokenPayload.put("requestId", effectiveReqId);
                                        tokenPayload.put("messageId", effectiveMsgId);
                                        sink.next(createSseEvent("token", tokenPayload));
                                    }
                                }
                            } catch (Exception e) {
                                log.debug("[Gemini SSE Parse Debug] Line: {}, Error: {}", trimmed, e.getMessage());
                            }
                        }
                    }
                }

                if (isCancelled.get() || sink.isCancelled()) {
                    long durationMs = System.currentTimeMillis() - startTime;
                    if (fullResponse.length() > 0 && conversationId != null && !conversationId.isBlank()) {
                        conversationStorageService.appendMessage(conversationId, Map.of(
                                "id", effectiveMsgId,
                                "role", "assistant",
                                "content", fullResponse.toString(),
                                "modelId", activeTargetModel,
                                "provider", getDisplayName(),
                                "providerId", getProviderId(),
                                "durationMs", durationMs,
                                "status", "cancelled",
                                "interrupted", true,
                                "createdAt", java.time.Instant.now().toString()
                        ));
                    }
                    sink.next(createSseEvent("cancelled", Map.of(
                            "status", "cancelled",
                            "requestId", effectiveReqId,
                            "messageId", effectiveMsgId,
                            "partialContent", fullResponse.toString()
                    )));
                    sink.complete();
                    return;
                }

                if (fullResponse.length() == 0) {
                    sink.next(createSseEvent("error", Map.of(
                            "error", "Google Gemini returned an empty response. Please try with another prompt.",
                            "provider", getDisplayName(),
                            "modelId", activeTargetModel,
                            "requestId", effectiveReqId,
                            "messageId", effectiveMsgId
                    )));
                    sink.next(createSseEvent("done", Map.of("status", "error", "requestId", effectiveReqId, "messageId", effectiveMsgId)));
                    sink.complete();
                    return;
                }

                long durationMs = System.currentTimeMillis() - startTime;
                double tokensPerSec = (durationMs > 0 && tokenCount > 0)
                        ? Math.round((tokenCount * 1000.0 / durationMs) * 10.0) / 10.0
                        : 0.0;

                // Save completed message with provider & model
                if (conversationId != null && !conversationId.isBlank()) {
                    Map<String, Object> assistantMsg = new LinkedHashMap<>();
                    assistantMsg.put("id", effectiveMsgId);
                    assistantMsg.put("role", "assistant");
                    assistantMsg.put("content", fullResponse.toString());
                    assistantMsg.put("modelId", activeTargetModel);
                    assistantMsg.put("provider", getDisplayName());
                    assistantMsg.put("providerId", getProviderId());
                    assistantMsg.put("durationMs", durationMs);
                    assistantMsg.put("ttftMs", firstTokenTimeMs > 0 ? firstTokenTimeMs : durationMs);
                    assistantMsg.put("tokenCount", tokenCount);
                    assistantMsg.put("tokensPerSec", tokensPerSec);
                    assistantMsg.put("status", "complete");
                    assistantMsg.put("createdAt", java.time.Instant.now().toString());

                    conversationStorageService.appendMessage(conversationId, assistantMsg);
                }

                String resolvedDisplayName = getModelDisplayName(activeTargetModel, modelId);
                Map<String, Object> metaMap = new LinkedHashMap<>();
                metaMap.put("provider", getDisplayName());
                metaMap.put("providerId", getProviderId());
                metaMap.put("modelId", activeTargetModel);
                metaMap.put("modelName", resolvedDisplayName);
                metaMap.put("durationMs", durationMs);
                metaMap.put("ttftMs", firstTokenTimeMs > 0 ? firstTokenTimeMs : durationMs);
                metaMap.put("tokenCount", tokenCount);
                metaMap.put("tokensPerSec", tokensPerSec);
                metaMap.put("requestId", effectiveReqId);
                metaMap.put("messageId", effectiveMsgId);

                sink.next(createSseEvent("metadata", metaMap));
                sink.next(createSseEvent("complete", Map.of("status", "complete", "requestId", effectiveReqId, "messageId", effectiveMsgId)));
                sink.next(createSseEvent("done", Map.of("status", "complete", "requestId", effectiveReqId, "messageId", effectiveMsgId)));
                sink.complete();

            } catch (Exception e) {
                if (isCancelled.get() || sink.isCancelled()) {
                    log.info("[Gemini Provider] Stream stopped on cancellation: reqId='{}'", effectiveReqId);
                    sink.next(createSseEvent("cancelled", Map.of("status", "cancelled", "requestId", effectiveReqId, "messageId", effectiveMsgId)));
                    sink.complete();
                    return;
                }
                String errorMsg = (e instanceof java.net.http.HttpTimeoutException)
                        ? "Google Gemini Timeout: Request timed out after 60 seconds."
                        : "Network error connecting to Google Gemini: " + e.getMessage();
                log.error("[Gemini Provider Exception] {}", errorMsg);
                sink.next(createSseEvent("error", Map.of(
                        "error", errorMsg,
                        "provider", getDisplayName(),
                        "modelId", initialTargetModel,
                        "requestId", effectiveReqId,
                        "messageId", effectiveMsgId
                )));
                sink.next(createSseEvent("done", Map.of("status", "error", "requestId", effectiveReqId, "messageId", effectiveMsgId)));
                sink.complete();
            } finally {
                if (cancellationRegistry != null) {
                    cancellationRegistry.unregister(effectiveReqId);
                }
            }
        }).subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic());
    }

    private boolean hasImageContent(List<Map<String, Object>> messages) {
        if (messages == null) return false;
        for (Map<String, Object> m : messages) {
            Object content = m.get("content");
            if (content instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> map && ("image_url".equals(map.get("type")) || map.containsKey("image_url"))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private List<String> buildModelFallbackChain(String requestedModel, boolean hasImage) {
        List<String> chain = new ArrayList<>();
        String primary = resolveTargetModel(requestedModel, hasImage);
        chain.add(primary);
        if (!chain.contains("gemini-3.5-flash")) chain.add("gemini-3.5-flash");
        if (!chain.contains("gemini-3.5-flash-lite")) chain.add("gemini-3.5-flash-lite");
        if (!chain.contains("gemini-2.5-flash")) chain.add("gemini-2.5-flash");
        return chain;
    }

    private String formatErrorMessage(int statusCode, String rawBody, String modelId) {
        String detail = "";
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            if (root.has("error")) {
                JsonNode errNode = root.get("error");
                if (errNode.isTextual()) {
                    detail = errNode.asText();
                } else if (errNode.has("message")) {
                    detail = errNode.get("message").asText();
                }
            } else if (root.has("message")) {
                detail = root.get("message").asText();
            }
        } catch (Exception ignored) {
            detail = rawBody;
        }

        if (detail.isBlank()) detail = rawBody;

        if (statusCode == 401) {
            return "Google Gemini Authentication Failed (HTTP 401): The GEMINI_API_KEY is invalid or expired. Check your key at https://aistudio.google.com/app/apikey.";
        }
        if (statusCode == 403) {
            return "Google Gemini Access Forbidden (HTTP 403): Your API key does not have permission for model '" + modelId + "'.";
        }
        if (statusCode == 429) {
            return "Google Gemini Rate Limit Exceeded (HTTP 429): Free-tier request rate limit reached for vision model '" + modelId + "'. " +
                   "Please wait a moment before trying again or configure additional provider keys.";
        }
        if (statusCode >= 500) {
            return "Google Gemini Server Error (HTTP " + statusCode + "): The service is temporarily unavailable. Please retry.";
        }

        return "Google Gemini API Error (HTTP " + statusCode + "): " + detail;
    }

    private String resolveTargetModel(String modelId, boolean hasImage) {
        if (modelId == null) return hasImage ? "gemini-3.5-flash" : "gemini-2.5-flash";
        String lower = modelId.toLowerCase();
        if (lower.contains("3.5-flash-lite")) return "gemini-3.5-flash-lite";
        if (lower.contains("3.5-flash")) return "gemini-3.5-flash";
        if (lower.contains("flash-latest")) return "gemini-3.5-flash";
        if (lower.contains("2.5-flash")) return "gemini-2.5-flash";
        if (hasImage || lower.contains("blip") || lower.contains("vit-gpt2") || lower.contains("trocr") ||
            lower.contains("git") || lower.contains("glm") || lower.contains("caption") || lower.contains("vision")) {
            return "gemini-3.5-flash";
        }
        return "gemini-2.5-flash";
    }

    private String getModelDisplayName(String targetModel, String requestedModelId) {
        if (requestedModelId != null) {
            String reqLower = requestedModelId.toLowerCase();
            if (reqLower.contains("blip-image-captioning-large")) return "BLIP Image Captioning Large (Salesforce)";
            if (reqLower.contains("blip-image-captioning-base")) return "BLIP Image Captioning Base (Salesforce)";
            if (reqLower.contains("blip")) return "BLIP Image Captioning (Salesforce)";
            if (reqLower.contains("vit-gpt2")) return "ViT-GPT2 Image Captioning";
            if (reqLower.contains("git-base")) return "Microsoft GIT Base";
            if (reqLower.contains("trocr")) return "Microsoft TrOCR Printed";
            if (reqLower.contains("glm-ocr")) return "GLM-OCR Document & Math";

            if (reqLower.contains("vision")) {
                if (reqLower.contains("3.5-flash-lite")) return "Gemini 3.5 Flash Lite Vision";
                if (reqLower.contains("3.5-flash")) return "Gemini 3.5 Flash Vision";
                if (reqLower.contains("flash-latest")) return "Gemini Flash Latest Vision";
                return "Gemini 2.5 Flash Vision";
            }
        }
        if ("gemini-3.5-flash-lite".equalsIgnoreCase(targetModel)) return "Gemini 3.5 Flash Lite";
        if ("gemini-3.5-flash".equalsIgnoreCase(targetModel)) return "Gemini 3.5 Flash";
        if ("gemini-flash-latest".equalsIgnoreCase(targetModel)) return "Gemini Flash Latest";
        if ("gemini-2.5-flash".equalsIgnoreCase(targetModel)) return "Gemini 2.5 Flash";
        return targetModel;
    }
}
