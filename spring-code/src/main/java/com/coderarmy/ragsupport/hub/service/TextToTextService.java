package com.coderarmy.ragsupport.hub.service;

import com.coderarmy.ragsupport.hub.model.HubModel;
import com.coderarmy.ragsupport.hub.model.TextGenerationRequest;
import com.coderarmy.ragsupport.hub.model.TextGenerationResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
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
 * Dedicated task service for Text-to-Text inference in Model Hub.
 * Supports synchronous text generation and Server-Sent Events (SSE) streaming.
 * Accurately parses response formats and reports authentic upstream errors.
 */
@Service
public class TextToTextService {

    private static final Logger log = LoggerFactory.getLogger(TextToTextService.class);

    private final HubRegistryService registryService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Autowired
    public TextToTextService(HubRegistryService registryService) {
        this.registryService = registryService;
    }

    public TextGenerationResponse generateText(TextGenerationRequest request) {
        long startTime = System.currentTimeMillis();
        String modelId = request.getModelId();
        HubModel model = registryService.getModel(modelId);
        String modelName = model != null ? model.getName() : modelId;
        String provider = model != null ? model.getProvider() : "External";

        try {
            List<Map<String, String>> messagesList = prepareMessages(request);

            if (modelId != null && modelId.toLowerCase().startsWith("gemini")) {
                return callGeminiSync(request, messagesList, startTime, modelName, provider);
            } else {
                return callHuggingFaceSync(request, messagesList, startTime, modelName, provider);
            }
        } catch (Exception e) {
            log.error("[TextToText] Generation error for model {}: {}", modelId, e.getMessage());
            long duration = System.currentTimeMillis() - startTime;
            return TextGenerationResponse.error(e.getMessage(), modelId, modelName, provider, duration);
        }
    }

    public Flux<ServerSentEvent<String>> streamText(TextGenerationRequest request) {
        long startTime = System.currentTimeMillis();
        String modelId = request.getModelId();
        HubModel model = registryService.getModel(modelId);
        String modelName = model != null ? model.getName() : modelId;
        String provider = model != null ? model.getProvider() : "External";

        List<Map<String, String>> messagesList = prepareMessages(request);

        if (modelId != null && modelId.toLowerCase().startsWith("gemini")) {
            return streamGemini(request, messagesList, startTime, modelName, provider);
        } else {
            return streamHuggingFace(request, messagesList, startTime, modelName, provider);
        }
    }

    private List<Map<String, String>> prepareMessages(TextGenerationRequest request) {
        List<Map<String, String>> messagesList = new ArrayList<>();

        if (request.getSystemInstruction() != null && !request.getSystemInstruction().isBlank()) {
            messagesList.add(Map.of("role", "system", "content", request.getSystemInstruction().trim()));
        }

        if (request.getMessages() != null && !request.getMessages().isEmpty()) {
            for (Map<String, String> m : request.getMessages()) {
                String role = m.getOrDefault("role", "user");
                String content = m.getOrDefault("content", "");
                if (!content.isBlank()) {
                    messagesList.add(Map.of("role", role, "content", content));
                }
            }
        }

        if (request.getPrompt() != null && !request.getPrompt().isBlank()) {
            // Only append prompt if not already the last message in history
            boolean alreadyPresent = false;
            if (!messagesList.isEmpty()) {
                Map<String, String> last = messagesList.get(messagesList.size() - 1);
                if ("user".equals(last.get("role")) && request.getPrompt().trim().equals(last.get("content").trim())) {
                    alreadyPresent = true;
                }
            }
            if (!alreadyPresent) {
                messagesList.add(Map.of("role", "user", "content", request.getPrompt().trim()));
            }
        }

        if (messagesList.isEmpty()) {
            messagesList.add(Map.of("role", "user", "content", "Hello"));
        }

        return messagesList;
    }

    private TextGenerationResponse callGeminiSync(
            TextGenerationRequest request,
            List<Map<String, String>> messagesList,
            long startTime,
            String modelName,
            String provider
    ) throws Exception {
        String geminiKey = registryService.getEffectiveGeminiKey();
        if (geminiKey == null || geminiKey.isBlank()) {
            throw new IllegalStateException("Google Gemini API key is not configured.");
        }

        Map<String, Object> req = new HashMap<>();
        req.put("model", "gemini-2.5-flash");
        req.put("messages", messagesList);
        req.put("max_tokens", request.getMaxTokens() != null ? request.getMaxTokens() : 2048);
        req.put("temperature", request.getTemperature() != null ? request.getTemperature() : 0.7);

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"))
                .header("Authorization", "Bearer " + geminiKey)
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(req)))
                .build();

        HttpResponse<String> resp = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        long duration = System.currentTimeMillis() - startTime;

        if (resp.statusCode() != 200) {
            return TextGenerationResponse.error("Gemini API Error (HTTP " + resp.statusCode() + "): " + resp.body(),
                    request.getModelId(), modelName, provider, duration);
        }

        JsonNode root = objectMapper.readTree(resp.body());
        String text = root.path("choices").path(0).path("message").path("content").asText("");
        int tokens = root.path("usage").path("total_tokens").asInt(0);

        return TextGenerationResponse.success(text, request.getModelId(), modelName, provider, duration, tokens);
    }

    private TextGenerationResponse callHuggingFaceSync(
            TextGenerationRequest request,
            List<Map<String, String>> messagesList,
            long startTime,
            String modelName,
            String provider
    ) throws Exception {
        String token = registryService.getEffectiveHfToken();
        if (token == null || token.isBlank()) {
            throw new IllegalStateException("Hugging Face Token (HF_TOKEN) is not configured in backend environment variables.");
        }

        String modelId = request.getModelId();
        HubModel modelMeta = registryService.getModel(modelId);
        String targetHfId = modelMeta != null && modelMeta.getHfModelId() != null ? modelMeta.getHfModelId() : modelId;

        Map<String, Object> req = new HashMap<>();
        req.put("model", targetHfId);
        req.put("messages", messagesList);
        req.put("max_tokens", request.getMaxTokens() != null ? request.getMaxTokens() : 1024);
        req.put("temperature", request.getTemperature() != null ? request.getTemperature() : 0.7);

        String endpointUrl = "https://router.huggingface.co/v1/chat/completions";
        if (targetHfId.toLowerCase().contains("qwen2.5-7b")) {
            endpointUrl = "https://router.huggingface.co/featherless-ai/v1/chat/completions";
        }

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(endpointUrl))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(req)))
                .build();

        HttpResponse<String> resp = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        long duration = System.currentTimeMillis() - startTime;

        if (resp.statusCode() == 402) {
            String msg = "Hugging Face Inference Error (HTTP 402 Payment Required): You have no remaining credits on your Hugging Face account for model '" + targetHfId + "'. Pre-paid credits or a PRO subscription are required on router.huggingface.co.";
            return TextGenerationResponse.error(msg, modelId, modelName, provider, duration);
        }

        if (resp.statusCode() != 200) {
            String msg = "Hugging Face Error (HTTP " + resp.statusCode() + "): " + resp.body();
            return TextGenerationResponse.error(msg, modelId, modelName, provider, duration);
        }

        JsonNode root = objectMapper.readTree(resp.body());
        String text = root.path("choices").path(0).path("message").path("content").asText("");
        int tokens = root.path("usage").path("total_tokens").asInt(0);

        return TextGenerationResponse.success(text, modelId, modelName, provider, duration, tokens);
    }

    private Flux<ServerSentEvent<String>> streamGemini(
            TextGenerationRequest request,
            List<Map<String, String>> messagesList,
            long startTime,
            String modelName,
            String provider
    ) {
        return Flux.create(sink -> {
            try {
                String geminiKey = registryService.getEffectiveGeminiKey();
                if (geminiKey == null || geminiKey.isBlank()) {
                    emitError(sink, "Missing GEMINI_API_KEY", request.getModelId(), modelName, provider);
                    return;
                }

                Map<String, Object> req = Map.of(
                        "model", "gemini-2.5-flash",
                        "messages", messagesList,
                        "stream", true,
                        "max_tokens", request.getMaxTokens() != null ? request.getMaxTokens() : 2048,
                        "temperature", request.getTemperature() != null ? request.getTemperature() : 0.7
                );

                HttpRequest httpRequest = HttpRequest.newBuilder()
                        .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"))
                        .header("Authorization", "Bearer " + geminiKey)
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(60))
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(req)))
                        .build();

                HttpResponse<java.io.InputStream> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofInputStream());

                if (response.statusCode() != 200) {
                    String err = readStream(response.body());
                    emitError(sink, "Gemini Error (HTTP " + response.statusCode() + "): " + err, request.getModelId(), modelName, provider);
                    return;
                }

                sink.next(createSse("metadata", Map.of(
                        "modelId", request.getModelId(),
                        "modelName", modelName,
                        "provider", provider
                )));

                try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty() || !trimmed.startsWith("data:")) continue;
                        String data = trimmed.substring(5).trim();
                        if ("[DONE]".equalsIgnoreCase(data)) break;

                        try {
                            JsonNode node = objectMapper.readTree(data);
                            JsonNode choices = node.path("choices");
                            if (choices.isArray() && choices.size() > 0) {
                                JsonNode delta = choices.get(0).path("delta");
                                if (delta.has("content")) {
                                    String token = delta.get("content").asText("");
                                    if (!token.isEmpty()) {
                                        sink.next(createSse("token", Map.of("content", token)));
                                    }
                                }
                            }
                        } catch (Exception ignored) {}
                    }
                }

                long duration = System.currentTimeMillis() - startTime;
                sink.next(createSse("done", Map.of(
                        "status", "complete",
                        "durationMs", duration
                )));
                sink.complete();
            } catch (Exception e) {
                emitError(sink, e.getMessage(), request.getModelId(), modelName, provider);
            }
        });
    }

    private Flux<ServerSentEvent<String>> streamHuggingFace(
            TextGenerationRequest request,
            List<Map<String, String>> messagesList,
            long startTime,
            String modelName,
            String provider
    ) {
        return Flux.create(sink -> {
            try {
                String token = registryService.getEffectiveHfToken();
                if (token == null || token.isBlank()) {
                    emitError(sink, "Missing HF_TOKEN environment variable.", request.getModelId(), modelName, provider);
                    return;
                }

                String targetHfId = request.getModelId();
                HubModel modelMeta = registryService.getModel(targetHfId);
                if (modelMeta != null && modelMeta.getHfModelId() != null) {
                    targetHfId = modelMeta.getHfModelId();
                }

                String endpointUrl = "https://router.huggingface.co/v1/chat/completions";
                if (targetHfId.toLowerCase().contains("qwen2.5-7b")) {
                    endpointUrl = "https://router.huggingface.co/featherless-ai/v1/chat/completions";
                }

                Map<String, Object> req = Map.of(
                        "model", targetHfId,
                        "messages", messagesList,
                        "stream", true,
                        "max_tokens", request.getMaxTokens() != null ? request.getMaxTokens() : 1024,
                        "temperature", request.getTemperature() != null ? request.getTemperature() : 0.7
                );

                HttpRequest httpRequest = HttpRequest.newBuilder()
                        .uri(URI.create(endpointUrl))
                        .header("Authorization", "Bearer " + token)
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(60))
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(req)))
                        .build();

                HttpResponse<java.io.InputStream> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofInputStream());

                if (response.statusCode() == 402) {
                    String err = "Hugging Face Inference Error (HTTP 402 Payment Required): You have no remaining credits on your Hugging Face account for model '" + targetHfId + "'. Pre-paid credits or a PRO subscription are required on router.huggingface.co.";
                    emitError(sink, err, request.getModelId(), modelName, provider);
                    return;
                }

                if (response.statusCode() != 200) {
                    String err = readStream(response.body());
                    emitError(sink, "Hugging Face Error (HTTP " + response.statusCode() + "): " + err, request.getModelId(), modelName, provider);
                    return;
                }

                sink.next(createSse("metadata", Map.of(
                        "modelId", request.getModelId(),
                        "modelName", modelName,
                        "provider", provider
                )));

                try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty() || !trimmed.startsWith("data:")) continue;
                        String data = trimmed.substring(5).trim();
                        if ("[DONE]".equalsIgnoreCase(data)) break;

                        try {
                            JsonNode node = objectMapper.readTree(data);
                            JsonNode choices = node.path("choices");
                            if (choices.isArray() && choices.size() > 0) {
                                JsonNode delta = choices.get(0).path("delta");
                                if (delta.has("content")) {
                                    String tokenStr = delta.get("content").asText("");
                                    if (!tokenStr.isEmpty()) {
                                        sink.next(createSse("token", Map.of("content", tokenStr)));
                                    }
                                }
                            }
                        } catch (Exception ignored) {}
                    }
                }

                long duration = System.currentTimeMillis() - startTime;
                sink.next(createSse("done", Map.of(
                        "status", "complete",
                        "durationMs", duration
                )));
                sink.complete();
            } catch (Exception e) {
                emitError(sink, e.getMessage(), request.getModelId(), modelName, provider);
            }
        });
    }

    private void emitError(reactor.core.publisher.FluxSink<ServerSentEvent<String>> sink, String message, String modelId, String modelName, String provider) {
        sink.next(createSse("error", Map.of(
                "error", message,
                "modelId", modelId != null ? modelId : "",
                "modelName", modelName != null ? modelName : "",
                "provider", provider != null ? provider : ""
        )));
        sink.next(createSse("done", Map.of("status", "error")));
        sink.complete();
    }

    private ServerSentEvent<String> createSse(String event, Map<String, Object> data) {
        try {
            return ServerSentEvent.<String>builder()
                    .event(event)
                    .data(objectMapper.writeValueAsString(data))
                    .build();
        } catch (Exception e) {
            return ServerSentEvent.<String>builder()
                    .event(event)
                    .data("{}")
                    .build();
        }
    }

    private String readStream(java.io.InputStream stream) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            return sb.toString().trim();
        } catch (Exception e) {
            return "";
        }
    }
}
