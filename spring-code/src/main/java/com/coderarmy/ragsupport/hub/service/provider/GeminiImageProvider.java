package com.coderarmy.ragsupport.hub.service.provider;

import com.coderarmy.ragsupport.hub.model.ImageErrorCategory;
import com.coderarmy.ragsupport.hub.model.ImageGenerationRequest;
import com.coderarmy.ragsupport.hub.model.ImageGenerationResponse;
import com.coderarmy.ragsupport.hub.service.PromptUnderstandingService.PromptSpecification;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Component
public class GeminiImageProvider implements ImageProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiImageProvider.class);

    private static final List<String> SUPPORTED = List.of(
            "gemini-nano-banana-2.1",
            "gemini-3.1-flash-image",
            "gemini-3-pro-image"
    );

    @Value("${gemini.api-key:}")
    private String configuredKey;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.ALWAYS)
            .connectTimeout(Duration.ofSeconds(45))
            .build();

    public String getEffectiveApiKey() {
        String env = System.getenv("GEMINI_API_KEY");
        if (env != null && !env.isBlank()) return env.trim();
        if (configuredKey != null && !configuredKey.isBlank() && !configuredKey.startsWith("${")) {
            return configuredKey.trim();
        }
        return "";
    }

    @Override
    public String getProviderId() {
        return "gemini";
    }

    @Override
    public String getDisplayName() {
        return "Google Gemini (Multimodal Image Synthesis)";
    }

    @Override
    public boolean supportsModel(String modelId) {
        if (modelId == null) return false;
        String m = modelId.toLowerCase();
        return m.contains("banana") || m.contains("gemini-3.1-flash-image") || m.contains("gemini-3-pro-image");
    }

    @Override
    public List<String> getSupportedModels() {
        return SUPPORTED;
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public String getAccessRequirement() {
        return "Google Cloud Billing Enabled Project (Paid Quota on ai.google.dev)";
    }

    @Override
    public ImageGenerationResponse generateImage(ImageGenerationRequest request, PromptSpecification spec, long startTime) {
        return executeGeminiGeneration(request, spec, Collections.emptyList(), startTime);
    }

    @Override
    public ImageGenerationResponse editImage(ImageGenerationRequest request, PromptSpecification spec, List<String> referenceImages, long startTime) {
        return executeGeminiGeneration(request, spec, referenceImages, startTime);
    }

    private ImageGenerationResponse executeGeminiGeneration(
            ImageGenerationRequest request,
            PromptSpecification spec,
            List<String> referenceImages,
            long startTime
    ) {
        String modelId = request.getModelId() != null ? request.getModelId() : "gemini-3.1-flash-image";
        String apiKey = getEffectiveApiKey();

        String prompt = spec.getModelSpecificPrompt() != null && !spec.getModelSpecificPrompt().isBlank()
                ? spec.getModelSpecificPrompt()
                : request.getPrompt();

        try {
            String endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + modelId + ":generateContent?key=" + apiKey;

            List<Map<String, Object>> parts = new ArrayList<>();
            parts.add(Map.of("text", prompt));

            // Attach reference images if present for multimodal image editing / reference guidance
            List<String> refs = new ArrayList<>();
            if (referenceImages != null && !referenceImages.isEmpty()) {
                refs.addAll(referenceImages);
            } else if (request.getReferenceImages() != null && !request.getReferenceImages().isEmpty()) {
                refs.addAll(request.getReferenceImages());
            }

            for (String ref : refs) {
                if (ref != null && ref.startsWith("data:")) {
                    int comma = ref.indexOf(',');
                    if (comma > 0) {
                        String mime = ref.substring(5, comma).split(";")[0];
                        String b64 = ref.substring(comma + 1);
                        parts.add(Map.of(
                                "inlineData", Map.of(
                                        "mimeType", mime,
                                        "data", b64
                                )
                        ));
                    }
                }
            }

            Map<String, Object> reqBody = new LinkedHashMap<>();
            reqBody.put("contents", List.of(Map.of("parts", parts)));

            // Generation config with IMAGE modality
            Map<String, Object> genConfig = new LinkedHashMap<>();
            genConfig.put("response_modalities", List.of("IMAGE", "TEXT"));

            String aspect = spec.getAspectRatio() != null ? spec.getAspectRatio() : "1:1";
            genConfig.put("image_config", Map.of(
                    "aspect_ratio", aspect,
                    "image_size", "2K"
            ));
            reqBody.put("generationConfig", genConfig);

            String jsonPayload = objectMapper.writeValueAsString(reqBody);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            long duration = System.currentTimeMillis() - startTime;

            if (response.statusCode() == 429) {
                String raw = response.body();
                boolean isZeroQuota = raw.contains("limit: 0") || raw.contains("FreeTier") || raw.contains("free_tier");
                String err = isZeroQuota
                        ? "Google Gemini Quota Notice (HTTP 429): Free Tier quota limit for image generation is 0 (`limit: 0`). Image generation models on Google AI Studio require an active Google Cloud Pay-As-You-Go billing account."
                        : "Google Gemini Rate Limited (HTTP 429): Request rate limit or daily quota reached for this project.";
                log.warn("[GeminiImageProvider] {}", err);
                ImageGenerationResponse errResp = ImageGenerationResponse.error(err, modelId, modelId, "Google Gemini", request.getPrompt(), duration);
                errResp.setErrorCategory(isZeroQuota ? ImageErrorCategory.ZERO_QUOTA.name() : ImageErrorCategory.RATE_LIMITED.name());
                errResp.setErrorReason(isZeroQuota 
                        ? "The selected project's image-generation quota is zero (`limit: 0`) on the Google AI Studio Free Tier." 
                        : "Request rate limit or daily quota reached for the current time window.");
                errResp.setErrorNextStep(isZeroQuota 
                        ? "Verify the project's billing and quota status in Google AI Studio, link a Google Cloud Billing account, or select a configured alternative model." 
                        : "Wait for the rate limit cooldown to expire before retrying.");
                errResp.setDocUrl("https://ai.google.dev/gemini-api/docs/billing");
                errResp.setCanRetry(!isZeroQuota);
                errResp.setCooldownSeconds(isZeroQuota ? 600 : 60);
                errResp.setCanFallback(true);
                errResp.setFallbackModelId("flux-schnell-free");
                errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
                errResp.setFallbackProvider("Pollinations (Free Hosted)");
                errResp.setActualModelId(modelId);
                errResp.setActualModelName(modelId);
                errResp.setActualProvider("Google Gemini");
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            if (response.statusCode() != 200) {
                String raw = response.body();
                String err = "Google Gemini Error (HTTP " + response.statusCode() + "): " + raw;
                log.error("[GeminiImageProvider] {}", err);
                ImageGenerationResponse errResp = ImageGenerationResponse.error(err, modelId, modelId, "Google Gemini", request.getPrompt(), duration);
                
                ImageErrorCategory cat;
                String reason;
                String nextStep;
                String docUrl;
                boolean canRetry = false;
                
                if (response.statusCode() == 401 || response.statusCode() == 403) {
                    cat = ImageErrorCategory.AUTHENTICATION_FAILED;
                    reason = "Google Generative Language API key is invalid, missing, or unauthorized.";
                    nextStep = "Check and update GEMINI_API_KEY in backend environment variables.";
                    docUrl = "https://ai.google.dev/gemini-api/docs/api-key";
                } else if (response.statusCode() == 404) {
                    cat = ImageErrorCategory.MODEL_UNAVAILABLE;
                    reason = "The requested model ID is not available on this Gemini endpoint.";
                    nextStep = "Select a supported model such as gemini-3.1-flash-image.";
                    docUrl = "https://ai.google.dev/gemini-api/docs/models/gemini";
                } else if (response.statusCode() >= 500) {
                    cat = ImageErrorCategory.PROVIDER_UNAVAILABLE;
                    reason = "Google Gemini service temporarily unavailable (HTTP " + response.statusCode() + ").";
                    nextStep = "Retry shortly or use the free fallback model.";
                    docUrl = "https://status.cloud.google.com";
                    canRetry = true;
                } else {
                    cat = ImageErrorCategory.MODEL_UNAVAILABLE;
                    reason = "Provider returned HTTP " + response.statusCode();
                    nextStep = "Inspect model parameters or switch models.";
                    docUrl = "https://ai.google.dev/gemini-api/docs";
                }
                
                errResp.setErrorCategory(cat.name());
                errResp.setErrorReason(reason);
                errResp.setErrorNextStep(nextStep);
                errResp.setDocUrl(docUrl);
                errResp.setCanRetry(canRetry);
                errResp.setCanFallback(true);
                errResp.setFallbackModelId("flux-schnell-free");
                errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
                errResp.setFallbackProvider("Pollinations (Free Hosted)");
                errResp.setActualModelId(modelId);
                errResp.setActualModelName(modelId);
                errResp.setActualProvider("Google Gemini");
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            // Parse response
            JsonNode root = objectMapper.readTree(response.body());
            String dataUrl = null;

            if (root.has("candidates") && root.get("candidates").isArray() && root.get("candidates").size() > 0) {
                JsonNode firstCand = root.get("candidates").get(0);
                JsonNode content = firstCand.path("content");
                JsonNode resParts = content.path("parts");
                if (resParts.isArray()) {
                    for (JsonNode part : resParts) {
                        JsonNode inline = part.has("inlineData") ? part.get("inlineData") : part.get("inline_data");
                        if (inline != null && inline.has("data")) {
                            String mime = inline.has("mimeType") ? inline.get("mimeType").asText() : "image/png";
                            String b64 = inline.get("data").asText();
                            dataUrl = "data:" + mime + ";base64," + b64;
                            break;
                        }
                    }
                }
            }

            if (dataUrl == null) {
                String err = "No image bytes returned in Google Gemini response payload.";
                ImageGenerationResponse errResp = ImageGenerationResponse.error(err, modelId, modelId, "Google Gemini", request.getPrompt(), duration);
                errResp.setErrorCategory("EMPTY_PAYLOAD");
                errResp.setCanFallback(true);
                errResp.setFallbackModelId("flux-schnell-free");
                errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
                errResp.setFallbackProvider("Pollinations (Free Hosted)");
                errResp.setActualModelId(modelId);
                errResp.setActualModelName(modelId);
                errResp.setActualProvider("Google Gemini");
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            String imageId = "img-gemini-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
            ImageGenerationResponse success = ImageGenerationResponse.success(
                    imageId,
                    modelId,
                    modelId,
                    "Google Gemini",
                    request.getPrompt(),
                    spec.getNegativePrompt(),
                    dataUrl,
                    spec.getWidth(),
                    spec.getHeight(),
                    spec.getAspectRatio(),
                    Instant.now().toString(),
                    duration
            );
            success.setActualModelId(modelId);
            success.setActualModelName(modelId);
            success.setActualProvider("Google Gemini");
            success.setEnhancedPrompt(spec.getModelSpecificPrompt());
            success.setStructuredSpec(spec.toMap());
            success.setHasReferenceImage(!refs.isEmpty());
            return success;

        } catch (Exception e) {
            log.error("[GeminiImageProvider] Generation failed for model {}: {}", modelId, e.getMessage());
            long duration = System.currentTimeMillis() - startTime;
            ImageGenerationResponse errResp = ImageGenerationResponse.error(e.getMessage(), modelId, modelId, "Google Gemini", request.getPrompt(), duration);
            boolean isTimeout = e instanceof java.net.http.HttpTimeoutException || (e.getMessage() != null && e.getMessage().toLowerCase().contains("timeout"));
            errResp.setErrorCategory(isTimeout ? ImageErrorCategory.NETWORK_TIMEOUT.name() : ImageErrorCategory.EXCEPTION.name());
            errResp.setErrorReason(isTimeout ? "Connection to Google Generative Language API timed out." : e.getMessage());
            errResp.setErrorNextStep(isTimeout ? "Check network connectivity and retry." : "Inspect server logs.");
            errResp.setDocUrl("https://ai.google.dev/gemini-api/docs");
            errResp.setCanRetry(true);
            errResp.setCanFallback(true);
            errResp.setFallbackModelId("flux-schnell-free");
            errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
            errResp.setFallbackProvider("Pollinations (Free Hosted)");
            errResp.setActualModelId(modelId);
            errResp.setActualModelName(modelId);
            errResp.setActualProvider("Google Gemini");
            errResp.setStructuredSpec(spec.toMap());
            return errResp;
        }
    }

    @Override
    public ImageProviderStatusCache.ProviderHealthStatus checkConnectivity(String modelId) {
        String mId = (modelId != null && !modelId.isBlank()) ? modelId : "gemini-3.1-flash-image";
        String apiKey = getEffectiveApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNCONFIGURED");
            s.setErrorCategory(ImageErrorCategory.AUTHENTICATION_FAILED);
            s.setErrorMessage("GEMINI_API_KEY is not configured.");
            s.setErrorReason("Missing API credential.");
            s.setErrorNextStep("Set GEMINI_API_KEY in backend environment variables.");
            s.setDocUrl("https://ai.google.dev/gemini-api/docs/api-key");
            s.setCanRetry(false);
            return s;
        }

        try {
            String endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + mId + ":generateContent?key=" + apiKey;
            Map<String, Object> reqBody = Map.of(
                    "contents", List.of(Map.of("parts", List.of(Map.of("text", "ping probe")))),
                    "generationConfig", Map.of("response_modalities", List.of("IMAGE"))
            );
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(reqBody), StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 200) {
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "AVAILABLE");
                s.setErrorMessage("Provider active and connected.");
                s.setCanRetry(true);
                return s;
            } else if (response.statusCode() == 429) {
                String b = response.body();
                boolean isZeroQuota = b.contains("limit: 0") || b.contains("FreeTier") || b.contains("free_tier");
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, isZeroQuota ? "ZERO_QUOTA" : "RATE_LIMITED");
                s.setErrorCategory(isZeroQuota ? ImageErrorCategory.ZERO_QUOTA : ImageErrorCategory.RATE_LIMITED);
                s.setErrorMessage(isZeroQuota 
                        ? "Google Gemini Quota Notice (HTTP 429): Free Tier quota limit for image generation is 0 (`limit: 0`)." 
                        : "Google Gemini Rate Limited (HTTP 429): Request limit reached.");
                s.setErrorReason(isZeroQuota 
                        ? "The selected project's image-generation quota is zero (`limit: 0`) on the Google AI Studio Free Tier." 
                        : "Request rate limit reached.");
                s.setErrorNextStep(isZeroQuota 
                        ? "Verify the project's billing and quota status in Google AI Studio, link a Google Cloud Billing account, or select a configured alternative model." 
                        : "Wait for the rate limit cooldown to expire.");
                s.setDocUrl("https://ai.google.dev/gemini-api/docs/billing");
                s.setCanRetry(!isZeroQuota);
                s.setCooldownUntil(Instant.now().plusSeconds(isZeroQuota ? 600 : 60));
                return s;
            } else if (response.statusCode() == 401 || response.statusCode() == 403) {
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNAVAILABLE");
                s.setErrorCategory(ImageErrorCategory.AUTHENTICATION_FAILED);
                s.setErrorMessage("Google Gemini Authentication Error (HTTP " + response.statusCode() + ")");
                s.setErrorReason("API Key invalid or unauthorized.");
                s.setErrorNextStep("Check GEMINI_API_KEY in backend environment variables.");
                s.setDocUrl("https://ai.google.dev/gemini-api/docs/api-key");
                s.setCanRetry(false);
                return s;
            } else {
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNAVAILABLE");
                s.setErrorCategory(ImageErrorCategory.MODEL_UNAVAILABLE);
                s.setErrorMessage("Google Gemini Error (HTTP " + response.statusCode() + "): " + response.body());
                s.setErrorReason("Model or endpoint unavailable.");
                s.setErrorNextStep("Select another supported model.");
                s.setCanRetry(false);
                return s;
            }
        } catch (Exception e) {
            ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNAVAILABLE");
            s.setErrorCategory(ImageErrorCategory.NETWORK_TIMEOUT);
            s.setErrorMessage("Connectivity probe failed: " + e.getMessage());
            s.setErrorReason("Connection timeout or network failure.");
            s.setErrorNextStep("Verify network connectivity.");
            s.setCanRetry(true);
            return s;
        }
    }
}
