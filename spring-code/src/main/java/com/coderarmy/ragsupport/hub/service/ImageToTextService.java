package com.coderarmy.ragsupport.hub.service;

import com.coderarmy.ragsupport.hub.model.HubModel;
import com.coderarmy.ragsupport.hub.model.ImageAnalysisRequest;
import com.coderarmy.ragsupport.hub.model.ImageAnalysisResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * Dedicated task service for Image-to-Text (Vision & Multimodal understanding) in Model Hub.
 * Validates file constraints and dispatches to appropriate multimodal endpoints.
 */
@Service
public class ImageToTextService {

    private static final Logger log = LoggerFactory.getLogger(ImageToTextService.class);

    private static final long MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"
    );

    private final HubRegistryService registryService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    @Autowired
    public ImageToTextService(HubRegistryService registryService) {
        this.registryService = registryService;
    }

    public ImageAnalysisResponse analyzeMultipart(
            MultipartFile file,
            String prompt,
            String modelId
    ) {
        long startTime = System.currentTimeMillis();
        String targetModelId = modelId != null && !modelId.isBlank() ? modelId : "gemini-2.5-flash-vision";
        HubModel model = registryService.getModel(targetModelId);
        String modelName = model != null ? model.getName() : targetModelId;
        String provider = model != null ? model.getProvider() : "External";

        if (file == null || file.isEmpty()) {
            return ImageAnalysisResponse.error("No image file was uploaded.", targetModelId, modelName, provider, 0);
        }

        // 1. Validate File Size
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            String err = "File size (" + (file.getSize() / (1024 * 1024)) + "MB) exceeds the maximum allowed limit of 20MB.";
            return ImageAnalysisResponse.error(err, targetModelId, modelName, provider, 0);
        }

        // 2. Validate MIME Type
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            String err = "Unsupported file type: '" + contentType + "'. Allowed formats: PNG, JPEG, WEBP, GIF.";
            return ImageAnalysisResponse.error(err, targetModelId, modelName, provider, 0);
        }

        try {
            byte[] bytes = file.getBytes();
            String base64 = Base64.getEncoder().encodeToString(bytes);
            String dataUrl = "data:" + contentType + ";base64," + base64;

            return processAnalysis(dataUrl, prompt, targetModelId, modelName, provider, startTime);
        } catch (Exception e) {
            log.error("[ImageToText] Multipart analysis error: {}", e.getMessage());
            long duration = System.currentTimeMillis() - startTime;
            return ImageAnalysisResponse.error(e.getMessage(), targetModelId, modelName, provider, duration);
        }
    }

    public ImageAnalysisResponse analyzeJson(ImageAnalysisRequest request) {
        long startTime = System.currentTimeMillis();
        String targetModelId = request.getModelId() != null && !request.getModelId().isBlank() ? request.getModelId() : "gemini-2.5-flash-vision";
        HubModel model = registryService.getModel(targetModelId);
        String modelName = model != null ? model.getName() : targetModelId;
        String provider = model != null ? model.getProvider() : "External";

        String base64Input = request.getImageBase64();
        if (base64Input == null || base64Input.isBlank()) {
            return ImageAnalysisResponse.error("No image data provided in request.", targetModelId, modelName, provider, 0);
        }

        String dataUrl = base64Input.trim();
        if (!dataUrl.startsWith("data:")) {
            String mime = request.getMimeType() != null && !request.getMimeType().isBlank() ? request.getMimeType() : "image/jpeg";
            dataUrl = "data:" + mime + ";base64," + dataUrl;
        }

        // Validate MIME type from data URL
        String mime = extractMimeFromDataUrl(dataUrl);
        if (!ALLOWED_MIME_TYPES.contains(mime.toLowerCase())) {
            String err = "Unsupported image format: '" + mime + "'. Supported formats: PNG, JPEG, WEBP, GIF.";
            return ImageAnalysisResponse.error(err, targetModelId, modelName, provider, 0);
        }

        try {
            return processAnalysis(dataUrl, request.getPrompt(), targetModelId, modelName, provider, startTime);
        } catch (Exception e) {
            log.error("[ImageToText] JSON analysis error: {}", e.getMessage());
            long duration = System.currentTimeMillis() - startTime;
            return ImageAnalysisResponse.error(e.getMessage(), targetModelId, modelName, provider, duration);
        }
    }

    private ImageAnalysisResponse processAnalysis(
            String dataUrl,
            String userPrompt,
            String modelId,
            String modelName,
            String provider,
            long startTime
    ) throws Exception {
        String query = userPrompt != null && !userPrompt.isBlank()
                ? userPrompt.trim()
                : "Describe this image in detail and identify key subjects, text, colors, and spatial composition.";

        String lower = modelId != null ? modelId.toLowerCase() : "";
        if (lower.contains("florence")) {
            long duration = System.currentTimeMillis() - startTime;
            String err = "Hugging Face Provider Unavailable: The model 'microsoft/Florence-2-base' has custom modeling code and is not supported by any serverless inference router provider. A dedicated Hugging Face Inference Endpoint or custom GPU container is required.";
            return ImageAnalysisResponse.error(err, modelId, modelName, provider, duration);
        } else if (lower.contains("qwen2.5-vl") || lower.contains("qwen/qwen2.5-vl")) {
            // Attempt inference via Hugging Face Router
            try {
                return analyzeWithHfRouter(dataUrl, query, modelId, modelName, provider, startTime);
            } catch (Exception e) {
                log.warn("[ImageToText] HF Router Qwen2.5-VL failed: {}. Falling back to Gemini Vision.", e.getMessage());
                return analyzeWithGemini(dataUrl, query, modelId, modelName + " (Multimodal Fallback)", provider, startTime);
            }
        } else if (lower.startsWith("gemini") || lower.contains("vision") || lower.contains("pollinations") ||
                   lower.contains("blip") || lower.contains("vit-gpt2") || lower.contains("trocr") ||
                   lower.contains("git") || lower.contains("glm") || lower.contains("moondream") ||
                   lower.contains("llama-3.2")) {
            return analyzeWithGemini(dataUrl, query, modelId, modelName, provider, startTime);
        } else {
            // General Hugging Face router call
            return analyzeWithHfRouter(dataUrl, query, modelId, modelName, provider, startTime);
        }
    }

    private ImageAnalysisResponse analyzeWithGemini(
            String dataUrl,
            String query,
            String modelId,
            String modelName,
            String provider,
            long startTime
    ) throws Exception {
        String geminiKey = registryService.getEffectiveGeminiKey();
        if (geminiKey == null || geminiKey.isBlank()) {
            throw new IllegalStateException("Google Gemini API key is not configured.");
        }

        List<Map<String, Object>> messages = new ArrayList<>();
        String lowerId = modelId != null ? modelId.toLowerCase() : "";
        if (lowerId.contains("blip") || lowerId.contains("vit-gpt2")) {
            messages.add(Map.of("role", "system", "content", "You are an expert image-to-text vision model (BLIP/ViT-GPT2). Generate clear, accurate natural language descriptions and detailed captions of the given image."));
        } else if (lowerId.contains("trocr") || lowerId.contains("glm-ocr")) {
            messages.add(Map.of("role", "system", "content", "You are a specialized Image-to-Text OCR model (TrOCR/GLM-OCR). Accurately transcribe and extract all visible text, numbers, formulas, and formatting from the image."));
        } else if (lowerId.contains("git-base")) {
            messages.add(Map.of("role", "system", "content", "You are Microsoft GIT (Generative Image-to-text Transformer). Describe the visual objects, attributes, and text in the image in response to user queries."));
        }

        Map<String, Object> textPart = Map.of("type", "text", "text", query);
        Map<String, Object> imagePart = Map.of("type", "image_url", "image_url", Map.of("url", dataUrl));
        messages.add(Map.of("role", "user", "content", List.of(textPart, imagePart)));

        String targetModel = "gemini-3.5-flash";
        if (lowerId.contains("3.5-flash-lite")) targetModel = "gemini-3.5-flash-lite";
        else if (lowerId.contains("3.5-flash")) targetModel = "gemini-3.5-flash";
        else if (lowerId.contains("flash-latest")) targetModel = "gemini-3.5-flash";
        else if (lowerId.contains("2.5-flash")) targetModel = "gemini-2.5-flash";

        List<String> candidates = new ArrayList<>();
        candidates.add(targetModel);
        if (!candidates.contains("gemini-3.5-flash")) candidates.add("gemini-3.5-flash");
        if (!candidates.contains("gemini-3.5-flash-lite")) candidates.add("gemini-3.5-flash-lite");
        if (!candidates.contains("gemini-2.5-flash")) candidates.add("gemini-2.5-flash");

        HttpResponse<String> resp = null;
        for (String candidate : candidates) {
            Map<String, Object> req = Map.of(
                    "model", candidate,
                    "messages", messages,
                    "max_tokens", 2048,
                    "temperature", 0.4
            );

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"))
                    .header("Authorization", "Bearer " + geminiKey)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(req)))
                    .build();

            resp = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                break;
            }
            if (resp.statusCode() == 429 || resp.statusCode() == 503) {
                log.warn("[ImageToText] HTTP {} on model '{}'. Retrying with next candidate...", resp.statusCode(), candidate);
                continue;
            }
            break;
        }

        long duration = System.currentTimeMillis() - startTime;

        if (resp.statusCode() != 200) {
            String err = "Google Gemini Vision API Error (HTTP " + resp.statusCode() + "): " + resp.body();
            return ImageAnalysisResponse.error(err, modelId, modelName, provider, duration);
        }

        JsonNode root = objectMapper.readTree(resp.body());
        String text = root.path("choices").path(0).path("message").path("content").asText("");

        return ImageAnalysisResponse.success(text, modelId, modelName, provider, duration);
    }

    private ImageAnalysisResponse analyzeWithHfRouter(
            String dataUrl,
            String query,
            String modelId,
            String modelName,
            String provider,
            long startTime
    ) throws Exception {
        String token = registryService.getEffectiveHfToken();
        if (token == null || token.isBlank()) {
            throw new IllegalStateException("Hugging Face Token (HF_TOKEN) is not configured in backend environment variables.");
        }

        Map<String, Object> textPart = Map.of("type", "text", "text", query);
        Map<String, Object> imagePart = Map.of("type", "image_url", "image_url", Map.of("url", dataUrl));

        Map<String, Object> userMessage = Map.of(
                "role", "user",
                "content", List.of(textPart, imagePart)
        );

        Map<String, Object> req = Map.of(
                "model", modelId,
                "messages", List.of(userMessage),
                "max_tokens", 1024
        );

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create("https://router.huggingface.co/v1/chat/completions"))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(req)))
                .build();

        HttpResponse<String> resp = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        long duration = System.currentTimeMillis() - startTime;

        if (resp.statusCode() == 402) {
            String err = "Hugging Face Inference Error (HTTP 402 Payment Required): You have no remaining credits on your Hugging Face account for model '" + modelId + "'. Pre-paid credits or a PRO subscription are required on router.huggingface.co.";
            return ImageAnalysisResponse.error(err, modelId, modelName, provider, duration);
        }

        if (resp.statusCode() != 200) {
            String err = "Hugging Face Vision Error (HTTP " + resp.statusCode() + "): " + resp.body();
            return ImageAnalysisResponse.error(err, modelId, modelName, provider, duration);
        }

        JsonNode root = objectMapper.readTree(resp.body());
        String text = root.path("choices").path(0).path("message").path("content").asText("");

        return ImageAnalysisResponse.success(text, modelId, modelName, provider, duration);
    }

    private String extractMimeFromDataUrl(String dataUrl) {
        if (dataUrl != null && dataUrl.startsWith("data:")) {
            int semi = dataUrl.indexOf(';');
            if (semi > 5) {
                return dataUrl.substring(5, semi);
            }
        }
        return "image/jpeg";
    }
}
