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
 * Groq High-Speed Inference Provider using Groq's official OpenAI-compatible endpoint.
 * Delivers ultra-low latency inference with official free-tier developer models
 * (llama-3.3-70b-versatile, llama-3.1-8b-instant).
 */
@Component
public class GroqProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(GroqProvider.class);

    @Value("${groq.api-key:}")
    private String configuredApiKey;

    @Value("${groq.endpoint:https://api.groq.com/openai/v1/chat/completions}")
    private String endpoint;

    private final ConversationStorageService conversationStorageService;
    @Autowired(required = false)
    private com.coderarmy.ragsupport.service.StreamCancellationRegistry cancellationRegistry;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Autowired
    public GroqProvider(ConversationStorageService conversationStorageService) {
        this.conversationStorageService = conversationStorageService;
    }

    public GroqProvider(ConversationStorageService conversationStorageService, com.coderarmy.ragsupport.service.StreamCancellationRegistry cancellationRegistry) {
        this.conversationStorageService = conversationStorageService;
        this.cancellationRegistry = cancellationRegistry;
    }

    public String getEffectiveApiKey() {
        String envKey = System.getenv("GROQ_API_KEY");
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
        return "groq";
    }

    @Override
    public String getDisplayName() {
        return "Groq (Free High-Speed)";
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
        return isConfigured() ? "Active (High-Speed Hosted LPU)" : "Missing GROQ_API_KEY";
    }

    @Override
    public boolean supportsModel(String modelId) {
        if (modelId == null) return false;
        String m = modelId.toLowerCase().trim();
        return m.startsWith("groq/") ||
               m.contains("qwen3.8") ||
               m.contains("gpt-oss") ||
               m.contains("llama-3.3") ||
               m.equals("llama-3.1-8b-instant") ||
               m.contains("versatile") ||
               m.contains("groq");
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

    public String resolveGroqModel(String modelId) {
        if (modelId == null || modelId.isBlank() || "auto".equalsIgnoreCase(modelId)) {
            return "qwen/qwen3.8-27b";
        }
        String clean = modelId.trim();
        if (clean.toLowerCase().startsWith("groq/")) {
            clean = clean.substring(5);
        }
        String lower = clean.toLowerCase();
        if (lower.contains("120b")) {
            return "openai/gpt-oss-120b";
        }
        if (lower.contains("20b")) {
            return "openai/gpt-oss-20b";
        }
        if (lower.contains("qwen") || lower.contains("llama") || lower.contains("versatile") || lower.contains("instant") || lower.equals("groq")) {
            return "qwen/qwen3.8-27b";
        }
        return clean;
    }

    private String getModelDisplayName(String modelId) {
        if ("qwen/qwen3.8-27b".equalsIgnoreCase(modelId)) {
            return "Qwen 3.8 27B (Groq LPU)";
        }
        if ("openai/gpt-oss-120b".equalsIgnoreCase(modelId)) {
            return "OpenAI GPT-OSS 120B (Groq)";
        }
        if ("openai/gpt-oss-20b".equalsIgnoreCase(modelId)) {
            return "OpenAI GPT-OSS 20B (Groq)";
        }
        if ("llama-3.1-8b-instant".equalsIgnoreCase(modelId)) {
            return "Llama 3.1 8B Instant (Groq)";
        }
        if ("llama-3.3-70b-versatile".equalsIgnoreCase(modelId)) {
            return "Llama 3.3 70B (Groq)";
        }
        return modelId;
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
        return streamChatInternal(modelId, messages, startTime, conversationId, false, requestId, messageId);
    }

    /**
     * Executes streamChat when invoked as an automatic fallback (e.g. from Gemini HTTP 429).
     */
    public Flux<ServerSentEvent<String>> streamChatAsFallback(
            String modelId,
            List<Map<String, Object>> messages,
            long startTime,
            String conversationId
    ) {
        String reqId = "req-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
        String msgId = "msg-" + System.currentTimeMillis() + "-assistant";
        return streamChatInternal(modelId, messages, startTime, conversationId, true, reqId, msgId);
    }

    public Flux<ServerSentEvent<String>> streamChatAsFallback(
            String modelId,
            List<Map<String, Object>> messages,
            long startTime,
            String conversationId,
            String requestId,
            String messageId
    ) {
        return streamChatInternal(modelId, messages, startTime, conversationId, true, requestId, messageId);
    }

    private Flux<ServerSentEvent<String>> streamChatInternal(
            String modelId,
            List<Map<String, Object>> messages,
            long startTime,
            String conversationId,
            boolean isFallback,
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
        String targetModel = resolveGroqModel(modelId);
        String providerName = isFallback ? "Groq High-Speed (Gemini 429 Fallback)" : getDisplayName();

        if (apiKey == null || apiKey.isBlank()) {
            log.error("[Groq Provider] Missing GROQ_API_KEY");
            return Flux.just(
                    createSseEvent("error", Map.of(
                            "error", "Groq Authentication Error (HTTP 401): The GROQ_API_KEY environment variable is not configured. " +
                                    "Please set GROQ_API_KEY to enable high-speed hosted inference (get a free key at https://console.groq.com/keys).",
                            "statusCode", 401,
                            "provider", providerName,
                            "modelId", targetModel,
                            "requestId", effectiveReqId,
                            "messageId", effectiveMsgId
                    )),
                    createSseEvent("done", Map.of("status", "error", "requestId", effectiveReqId, "messageId", effectiveMsgId))
            );
        }

        log.info("[Groq Provider] Streaming chat for model '{}' via endpoint '{}' (fallback: {}, reqId: '{}')",
                targetModel, endpoint, isFallback, effectiveReqId);

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
                Map<String, Object> requestBody = Map.of(
                        "model", targetModel,
                        "messages", messages,
                        "stream", true,
                        "max_tokens", 2048,
                        "temperature", 0.7
                );

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(endpoint))
                        .header("Authorization", "Bearer " + apiKey)
                        .header("Content-Type", "application/json")
                        .header("User-Agent", "YashAI-Chat/1.0")
                        .timeout(Duration.ofSeconds(45))
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                        .build();

                HttpResponse<java.io.InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
                int statusCode = response.statusCode();

                if (isCancelled.get() || sink.isCancelled()) {
                    log.info("[Groq Provider] Stream cancelled before processing: reqId='{}'", effectiveReqId);
                    sink.next(createSseEvent("cancelled", Map.of("status", "cancelled", "requestId", effectiveReqId, "messageId", effectiveMsgId)));
                    sink.complete();
                    return;
                }

                if (statusCode != 200) {
                    String rawError = "";
                    try (BufferedReader errReader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                        StringBuilder sb = new StringBuilder();
                        String l;
                        while ((l = errReader.readLine()) != null) {
                            sb.append(l).append("\n");
                        }
                        rawError = sb.toString().trim();
                    }

                    String friendlyMsg = formatErrorMessage(statusCode, rawError, targetModel);
                    log.error("[Groq Provider Error] Status: {}, Detail: {}", statusCode, friendlyMsg);

                    sink.next(createSseEvent("error", Map.of(
                            "error", friendlyMsg,
                            "statusCode", statusCode,
                            "provider", providerName,
                            "modelId", targetModel,
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
                            log.info("[Groq Provider] Stream cancelled mid-stream by client: convId={}, reqId={}", conversationId, effectiveReqId);
                            break;
                        }

                        String trimmed = line.trim();
                        if (trimmed.isEmpty() || trimmed.startsWith(":")) continue;

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
                                log.debug("[Groq SSE Parse Debug] Line: {}, Error: {}", trimmed, e.getMessage());
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
                                "modelId", targetModel,
                                "provider", providerName,
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
                            "error", "Groq returned an empty response. Please try with another prompt.",
                            "provider", providerName,
                            "modelId", targetModel,
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

                // Save assistant message to persistent conversation history
                if (conversationId != null && !conversationId.isBlank()) {
                    Map<String, Object> assistantMsg = new LinkedHashMap<>();
                    assistantMsg.put("id", effectiveMsgId);
                    assistantMsg.put("role", "assistant");
                    assistantMsg.put("content", fullResponse.toString());
                    assistantMsg.put("modelId", targetModel);
                    assistantMsg.put("provider", providerName);
                    assistantMsg.put("providerId", getProviderId());
                    assistantMsg.put("durationMs", durationMs);
                    assistantMsg.put("ttftMs", firstTokenTimeMs > 0 ? firstTokenTimeMs : durationMs);
                    assistantMsg.put("tokenCount", tokenCount);
                    assistantMsg.put("tokensPerSec", tokensPerSec);
                    assistantMsg.put("status", "complete");
                    assistantMsg.put("createdAt", java.time.Instant.now().toString());

                    conversationStorageService.appendMessage(conversationId, assistantMsg);
                }

                Map<String, Object> metaMap = new LinkedHashMap<>();
                metaMap.put("provider", providerName);
                metaMap.put("providerId", getProviderId());
                metaMap.put("modelId", targetModel);
                metaMap.put("modelName", getModelDisplayName(targetModel));
                metaMap.put("durationMs", durationMs);
                metaMap.put("ttftMs", firstTokenTimeMs > 0 ? firstTokenTimeMs : durationMs);
                metaMap.put("tokenCount", tokenCount);
                metaMap.put("tokensPerSec", tokensPerSec);
                metaMap.put("fallback", isFallback);
                metaMap.put("requestId", effectiveReqId);
                metaMap.put("messageId", effectiveMsgId);

                sink.next(createSseEvent("metadata", metaMap));
                sink.next(createSseEvent("complete", Map.of("status", "complete", "requestId", effectiveReqId, "messageId", effectiveMsgId)));
                sink.next(createSseEvent("done", Map.of("status", "complete", "requestId", effectiveReqId, "messageId", effectiveMsgId)));
                sink.complete();

            } catch (Exception e) {
                if (isCancelled.get() || sink.isCancelled()) {
                    log.info("[Groq Provider] Stream stopped on cancellation: reqId='{}'", effectiveReqId);
                    sink.next(createSseEvent("cancelled", Map.of("status", "cancelled", "requestId", effectiveReqId, "messageId", effectiveMsgId)));
                    sink.complete();
                    return;
                }
                String errorMsg = (e instanceof java.net.http.HttpTimeoutException)
                        ? "Groq Timeout: Request timed out after 45 seconds."
                        : "Network error connecting to Groq: " + e.getMessage();
                log.error("[Groq Provider Exception] {}", errorMsg);
                sink.next(createSseEvent("error", Map.of(
                        "error", errorMsg,
                        "provider", providerName,
                        "modelId", targetModel,
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
            return "Groq Authentication Failed (HTTP 401): The GROQ_API_KEY is invalid or missing. Check your key at https://console.groq.com/keys.";
        }
        if (statusCode == 403) {
            return "Groq Access Forbidden (HTTP 403): Your account does not have permission for model '" + modelId + "'.";
        }
        if (statusCode == 404) {
            return "Groq Model Not Found (HTTP 404): The requested model '" + modelId + "' was not found or is deprecated. Try 'llama-3.3-70b-versatile' or 'llama-3.1-8b-instant'.";
        }
        if (statusCode == 429) {
            return "Groq Rate Limit Exceeded (HTTP 429): Free-tier request rate limit reached (30 RPM). Please wait a moment and try again.";
        }
        if (statusCode >= 500) {
            return "Groq Server Error (HTTP " + statusCode + "): Groq service is temporarily unavailable. Please retry.";
        }

        return "Groq API Error (HTTP " + statusCode + "): " + detail;
    }
}
