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
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * Local Ollama Provider.
 * Connects to local Ollama instance on http://localhost:11434/v1/chat/completions.
 * Provides private, zero-cost inference without external API keys.
 */
@Component
public class OllamaProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(OllamaProvider.class);

    @Value("${ollama.endpoint:http://localhost:11434/v1/chat/completions}")
    private String endpoint;

    @Value("${ollama.base-url:http://localhost:11434}")
    private String baseUrl;

    private final ConversationStorageService conversationStorageService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    @Autowired
    public OllamaProvider(ConversationStorageService conversationStorageService) {
        this.conversationStorageService = conversationStorageService;
    }

    @Override
    public String getProviderId() {
        return "ollama";
    }

    @Override
    public String getDisplayName() {
        return "Local Ollama";
    }

    @Override
    public boolean isConfigured() {
        return endpoint != null && !endpoint.isBlank();
    }

    @Override
    public boolean isAvailable() {
        try {
            HttpRequest ping = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/tags"))
                    .timeout(Duration.ofSeconds(2))
                    .GET()
                    .build();
            HttpResponse<Void> resp = httpClient.send(ping, HttpResponse.BodyHandlers.discarding());
            return resp.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public String getStatusDescription() {
        return isAvailable() ? "Running on " + baseUrl : "Offline (Start with 'ollama serve')";
    }

    @Override
    public boolean supportsModel(String modelId) {
        if (modelId == null) return false;
        String m = modelId.toLowerCase();
        return m.startsWith("ollama/") || m.contains(":7b") || m.contains(":8b") || m.contains(":latest") ||
                m.equals("qwen2.5:7b") || m.equals("llama3.1:8b") || m.equals("mistral:7b") || m.equals("deepseek-r1:8b");
    }

    public List<String> getAvailableLocalModels() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/tags"))
                    .timeout(Duration.ofSeconds(2))
                    .GET()
                    .build();
            HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(resp.body());
                JsonNode models = root.path("models");
                List<String> list = new ArrayList<>();
                if (models.isArray()) {
                    for (JsonNode m : models) {
                        String name = m.path("name").asText();
                        if (!name.isBlank()) list.add(name);
                    }
                }
                return list;
            }
        } catch (Exception ignored) {}
        return Collections.emptyList();
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
        String cleanModel = modelId.startsWith("ollama/") ? modelId.substring(7) : modelId;

        // Verify Ollama reachability before streaming
        if (!isAvailable()) {
            String errorMsg = "Local Ollama Connection Error (HTTP 503): Cannot reach Ollama at " + baseUrl +
                    ". Please verify Ollama is installed and running on your machine ('ollama serve'). " +
                    "To install Ollama, visit https://ollama.com and run 'ollama run " + cleanModel + "'.";
            log.warn("[Ollama Provider] Ollama daemon is offline at {}", baseUrl);
            return Flux.just(
                    createSseEvent("error", Map.of(
                            "error", errorMsg,
                            "statusCode", 503,
                            "provider", getDisplayName(),
                            "modelId", cleanModel
                    )),
                    createSseEvent("done", Map.of("status", "error"))
            );
        }

        log.info("[Ollama Provider] Streaming chat for model '{}' via endpoint '{}'", cleanModel, endpoint);

        return Flux.<ServerSentEvent<String>>create(sink -> {
            try {
                Map<String, Object> requestBody = Map.of(
                        "model", cleanModel,
                        "messages", messages,
                        "stream", true,
                        "temperature", 0.7
                );

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(endpoint))
                        .header("Content-Type", "application/json")
                        .header("User-Agent", "YashAI-Chat/1.0")
                        .timeout(Duration.ofSeconds(120))
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

                    String friendlyMsg = (statusCode == 404)
                            ? "Ollama Model Not Found (HTTP 404): Model '" + cleanModel + "' has not been pulled locally. In your terminal, run: `ollama pull " + cleanModel + "`."
                            : "Ollama Error (HTTP " + statusCode + "): " + rawError;

                    log.error("[Ollama Error] Status: {}, Detail: {}", statusCode, friendlyMsg);

                    sink.next(createSseEvent("error", Map.of(
                            "error", friendlyMsg,
                            "statusCode", statusCode,
                            "provider", getDisplayName(),
                            "modelId", cleanModel
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
                                log.debug("[Ollama SSE Parse Debug] Line: {}, Error: {}", trimmed, e.getMessage());
                            }
                        }
                    }
                }

                if (fullResponse.length() == 0) {
                    sink.next(createSseEvent("error", Map.of(
                            "error", "Ollama returned an empty response. Please verify model weights with `ollama run " + cleanModel + "`.",
                            "provider", getDisplayName(),
                            "modelId", cleanModel
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
                            "modelId", cleanModel,
                            "provider", getDisplayName(),
                            "providerId", getProviderId(),
                            "durationMs", durationMs,
                            "createdAt", java.time.Instant.now().toString()
                    ));
                }

                sink.next(createSseEvent("metadata", Map.of(
                        "provider", getDisplayName(),
                        "providerId", getProviderId(),
                        "modelId", cleanModel,
                        "modelName", cleanModel,
                        "durationMs", durationMs
                )));
                sink.next(createSseEvent("done", Map.of("status", "complete")));
                sink.complete();

            } catch (Exception e) {
                String errorMsg = (e instanceof ConnectException)
                        ? "Local Ollama Connection Error (HTTP 503): Ollama process exited or connection was refused. Run 'ollama serve'."
                        : ((e instanceof HttpTimeoutException)
                        ? "Local Ollama Timeout: Generation took longer than 120 seconds."
                        : "Error communicating with local Ollama: " + e.getMessage());

                log.error("[Ollama Exception] {}", errorMsg);
                sink.next(createSseEvent("error", Map.of(
                        "error", errorMsg,
                        "provider", getDisplayName(),
                        "modelId", cleanModel
                )));
                sink.next(createSseEvent("done", Map.of("status", "error")));
                sink.complete();
            }
        }).subscribeOn(reactor.core.scheduler.Schedulers.boundedElastic());
    }
}
