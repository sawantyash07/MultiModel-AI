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
 * Hugging Face Inference Providers adapter.
 * Connects to Hugging Face serverless hosted providers (Featherless AI, Novita, DeepInfra, etc.).
 * Gracefully reports HTTP 402 quota-exhaustion, 401 token errors, and 429 limits.
 */
@Component
public class HfInferenceProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(HfInferenceProvider.class);

    @Value("${huggingface.token:}")
    private String configuredToken;

    @Value("${huggingface.endpoint:https://router.huggingface.co/featherless-ai/v1/chat/completions}")
    private String configuredEndpoint;

    @Value("${huggingface.provider:featherless-ai}")
    private String configuredProvider;

    private final ConversationStorageService conversationStorageService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Autowired
    public HfInferenceProvider(ConversationStorageService conversationStorageService) {
        this.conversationStorageService = conversationStorageService;
    }

    public String getEffectiveHfToken() {
        String envToken = System.getenv("HF_TOKEN");
        if (envToken != null && !envToken.isBlank()) {
            return envToken.trim();
        }
        if (configuredToken != null && !configuredToken.isBlank() && !configuredToken.startsWith("${")) {
            return configuredToken.trim();
        }
        return null;
    }

    @Override
    public String getProviderId() {
        return "huggingface";
    }

    @Override
    public String getDisplayName() {
        return "Hugging Face (Inference Providers)";
    }

    @Override
    public boolean isConfigured() {
        String token = getEffectiveHfToken();
        return token != null && !token.isBlank();
    }

    @Override
    public boolean isAvailable() {
        return isConfigured();
    }

    @Override
    public String getStatusDescription() {
        return isConfigured() ? "Token Configured (Paid Credits Required)" : "Missing HF_TOKEN";
    }

    @Override
    public boolean supportsModel(String modelId) {
        if (modelId == null) return false;
        String m = modelId.toLowerCase();
        return m.contains("/") && !m.startsWith("ollama/") || m.contains("qwen2.5-7b") || m.contains("llama-3.1") || m.contains("gemma-3") || m.contains("phi-4");
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

    public String resolveEndpointForModel(String modelId) {
        if ("Qwen/Qwen2.5-7B-Instruct".equalsIgnoreCase(modelId)) {
            if (configuredEndpoint != null && !configuredEndpoint.isBlank()) {
                return configuredEndpoint.trim();
            }
            return "https://router.huggingface.co/featherless-ai/v1/chat/completions";
        }
        return "https://router.huggingface.co/v1/chat/completions";
    }

    @Override
    public Flux<ServerSentEvent<String>> streamChat(
            String modelId,
            List<Map<String, Object>> messages,
            long startTime,
            String conversationId
    ) {
        String token = getEffectiveHfToken();
        if (token == null || token.isBlank()) {
            log.error("[HF Provider] Missing HF_TOKEN");
            return Flux.just(
                    createSseEvent("error", Map.of(
                            "error", "Hugging Face Authentication Failed (HTTP 401): The HF_TOKEN environment variable is not configured. Please set HF_TOKEN or switch to a free-tier hosted model ('gemini-2.5-flash').",
                            "statusCode", 401,
                            "provider", getDisplayName(),
                            "modelId", modelId
                    )),
                    createSseEvent("done", Map.of("status", "error"))
            );
        }

        String endpointUrl = resolveEndpointForModel(modelId);
        log.info("[HF Provider] Routing model '{}' via endpoint '{}'", modelId, endpointUrl);

        return Flux.<ServerSentEvent<String>>create(sink -> {
            try {
                Map<String, Object> requestBody = Map.of(
                        "model", modelId,
                        "messages", messages,
                        "stream", true,
                        "max_tokens", 1024,
                        "temperature", 0.7
                );

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(endpointUrl))
                        .header("Authorization", "Bearer " + token)
                        .header("Content-Type", "application/json")
                        .header("User-Agent", "YashAI-Chat/1.0")
                        .timeout(Duration.ofSeconds(60))
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                        .build();

                HttpResponse<java.io.InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
                int statusCode = response.statusCode();

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

                    String friendlyMsg = formatErrorMessage(statusCode, rawError, modelId);
                    log.error("[HF Provider Error] Status: {}, Model: {}, Detail: {}", statusCode, modelId, friendlyMsg);

                    sink.next(createSseEvent("error", Map.of(
                            "error", friendlyMsg,
                            "statusCode", statusCode,
                            "provider", getDisplayName(),
                            "modelId", modelId
                    )));
                    sink.next(createSseEvent("done", Map.of("status", "error")));
                    sink.complete();
                    return;
                }

                StringBuilder fullResponse = new StringBuilder();

                try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty()) continue;

                        if (trimmed.equals("data: [DONE]")) break;

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
                                        fullResponse.append(chunk);
                                        sink.next(createSseEvent("token", Map.of("content", chunk)));
                                    }
                                }
                            } catch (Exception e) {
                                log.debug("[HF SSE Parse Debug] Line: {}, Error: {}", trimmed, e.getMessage());
                            }
                        }
                    }
                }

                if (fullResponse.length() == 0) {
                    sink.next(createSseEvent("error", Map.of(
                            "error", "Hugging Face returned an empty response for model '" + modelId + "'. Please try again with a different prompt.",
                            "provider", getDisplayName(),
                            "modelId", modelId
                    )));
                    sink.next(createSseEvent("done", Map.of("status", "error")));
                    sink.complete();
                    return;
                }

                long durationMs = System.currentTimeMillis() - startTime;

                if (conversationId != null && !conversationId.isBlank()) {
                    conversationStorageService.appendMessage(conversationId, Map.of(
                            "id", "msg-" + System.currentTimeMillis() + "-assistant",
                            "role", "assistant",
                            "content", fullResponse.toString(),
                            "modelId", modelId,
                            "provider", getDisplayName(),
                            "providerId", getProviderId(),
                            "durationMs", durationMs,
                            "createdAt", java.time.Instant.now().toString()
                    ));
                }

                sink.next(createSseEvent("metadata", Map.of(
                        "provider", getDisplayName(),
                        "providerId", getProviderId(),
                        "modelId", modelId,
                        "modelName", modelId.split("/")[modelId.split("/").length - 1],
                        "durationMs", durationMs
                )));
                sink.next(createSseEvent("done", Map.of("status", "complete")));
                sink.complete();

            } catch (Exception e) {
                String errorMsg = (e instanceof java.net.http.HttpTimeoutException)
                        ? "Hugging Face Request Timeout: Provider timed out after 60 seconds for model '" + modelId + "'."
                        : "Network error contacting Hugging Face: " + e.getMessage();

                log.error("[HF Provider Exception] {}", errorMsg);
                sink.next(createSseEvent("error", Map.of(
                        "error", errorMsg,
                        "provider", getDisplayName(),
                        "modelId", modelId
                )));
                sink.next(createSseEvent("done", Map.of("status", "error")));
                sink.complete();
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

        if (statusCode == 402 || detail.toLowerCase().contains("no remaining credits") || detail.toLowerCase().contains("payment required")) {
            return "Hugging Face Inference Provider Quota Exhausted (HTTP 402): " +
                    "Your Hugging Face account has no remaining Inference Provider credits for model '" + modelId + "'. " +
                    "To continue without purchasing credits, switch to an available free-tier hosted model ('gemini-2.5-flash') or connect a local Ollama model ('qwen2.5:7b'). " +
                    "(HF Billing: https://huggingface.co/settings/billing)";
        }
        if (statusCode == 400 && (detail.toLowerCase().contains("not supported by any provider") || detail.toLowerCase().contains("provider"))) {
            return "Hugging Face Provider Routing Notice (HTTP 400): Model '" + modelId + "' is not supported by any active provider on your account. Switch to 'gemini-2.5-flash' or 'qwen2.5:7b'.";
        }
        if (statusCode == 401) {
            return "Hugging Face Authentication Failed (HTTP 401): The configured HF_TOKEN is invalid, expired, or missing inference permissions. Verify at https://huggingface.co/settings/tokens.";
        }
        if (statusCode == 403) {
            return "Hugging Face Access Forbidden (HTTP 403): You do not have permissions to access model '" + modelId + "'. Check license terms at https://huggingface.co/" + modelId + ".";
        }
        if (statusCode == 429) {
            return "Hugging Face Rate Limit Exceeded (HTTP 429): Too many requests sent for model '" + modelId + "'. Please wait a moment.";
        }
        if (statusCode >= 500) {
            return "Hugging Face Service Unavailable (HTTP " + statusCode + "): Model '" + modelId + "' is warming up or temporarily unavailable. Please retry.";
        }

        return "Hugging Face API Error (HTTP " + statusCode + "): " + detail;
    }
}
