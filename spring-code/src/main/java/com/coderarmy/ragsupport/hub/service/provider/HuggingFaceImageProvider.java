package com.coderarmy.ragsupport.hub.service.provider;

import com.coderarmy.ragsupport.hub.model.ImageErrorCategory;
import com.coderarmy.ragsupport.hub.model.ImageGenerationRequest;
import com.coderarmy.ragsupport.hub.model.ImageGenerationResponse;
import com.coderarmy.ragsupport.hub.service.PromptUnderstandingService.PromptSpecification;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
public class HuggingFaceImageProvider implements ImageProvider {

    private static final Logger log = LoggerFactory.getLogger(HuggingFaceImageProvider.class);

    private static final List<String> SUPPORTED = List.of(
            "black-forest-labs/FLUX.1-schnell",
            "stabilityai/stable-diffusion-xl-base-1.0"
    );

    @Value("${huggingface.token:}")
    private String configuredToken;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.ALWAYS)
            .connectTimeout(Duration.ofSeconds(45))
            .build();

    public String getEffectiveToken() {
        String env = System.getenv("HF_TOKEN");
        if (env != null && !env.isBlank()) return env.trim();
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
        return "Hugging Face (Hosted Diffusion Router)";
    }

    @Override
    public boolean supportsModel(String modelId) {
        if (modelId == null) return false;
        String m = modelId.toLowerCase();
        return m.contains("black-forest-labs") || m.contains("stabilityai") || m.contains("sdxl") || m.contains("stable-diffusion");
    }

    @Override
    public List<String> getSupportedModels() {
        return SUPPORTED;
    }

    @Override
    public boolean isAvailable() {
        return getEffectiveToken() != null;
    }

    @Override
    public String getAccessRequirement() {
        return "Pre-Paid HF Router Credits or PRO Subscription (router.huggingface.co)";
    }

    @Override
    public ImageGenerationResponse generateImage(ImageGenerationRequest request, PromptSpecification spec, long startTime) {
        return executeGeneration(request, spec, Collections.emptyList(), startTime);
    }

    @Override
    public ImageGenerationResponse editImage(ImageGenerationRequest request, PromptSpecification spec, List<String> referenceImages, long startTime) {
        return executeGeneration(request, spec, referenceImages, startTime);
    }

    private ImageGenerationResponse executeGeneration(
            ImageGenerationRequest request,
            PromptSpecification spec,
            List<String> referenceImages,
            long startTime
    ) {
        String modelId = request.getModelId() != null ? request.getModelId() : "black-forest-labs/FLUX.1-schnell";
        String token = getEffectiveToken();

        if (token == null || token.isBlank()) {
            String err = "Hugging Face Token (HF_TOKEN) is not configured in backend environment variables.";
            return ImageGenerationResponse.error(err, modelId, modelId, "Hugging Face", request.getPrompt(), 0);
        }

        String prompt = spec.getModelSpecificPrompt() != null && !spec.getModelSpecificPrompt().isBlank()
                ? spec.getModelSpecificPrompt()
                : request.getPrompt();

        try {
            String endpointUrl = "https://router.huggingface.co/nscale/v1/images/generations";
            if (modelId.toLowerCase().contains("stable-diffusion") || modelId.toLowerCase().contains("sdxl")) {
                endpointUrl = "https://router.huggingface.co/fal-ai/fal-ai/fast-sdxl";
            }

            Map<String, Object> reqBody = new HashMap<>();
            reqBody.put("prompt", prompt);
            reqBody.put("model", modelId);
            if (request.getNegativePrompt() != null && !request.getNegativePrompt().isBlank()) {
                reqBody.put("negative_prompt", request.getNegativePrompt().trim());
            } else if (spec.getNegativePrompt() != null && !spec.getNegativePrompt().isBlank()) {
                reqBody.put("negative_prompt", spec.getNegativePrompt().trim());
            }

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(endpointUrl))
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(reqBody)))
                    .build();

            HttpResponse<byte[]> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofByteArray());
            long duration = System.currentTimeMillis() - startTime;

            if (response.statusCode() == 402) {
                String err = "Hugging Face Payment Required (HTTP 402): You have 0 credits on your Hugging Face account for model `" + modelId + "`. Pre-paid credits or a PRO subscription are required on router.huggingface.co.";
                ImageGenerationResponse errResp = ImageGenerationResponse.error(err, modelId, modelId, "Hugging Face", request.getPrompt(), duration);
                errResp.setErrorCategory(ImageErrorCategory.BILLING_REQUIRED.name());
                errResp.setErrorReason("0 credit balance on router.huggingface.co.");
                errResp.setErrorNextStep("Add pre-paid credits at huggingface.co/settings/billing or use Free Diffusion.");
                errResp.setDocUrl("https://huggingface.co/settings/billing");
                errResp.setCanRetry(false);
                errResp.setCanFallback(true);
                errResp.setFallbackModelId("flux-schnell-free");
                errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
                errResp.setFallbackProvider("Pollinations (Free Hosted)");
                errResp.setActualModelId(modelId);
                errResp.setActualModelName(modelId);
                errResp.setActualProvider("Hugging Face");
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            if (response.statusCode() == 410) {
                String rawErr = new String(response.body(), StandardCharsets.UTF_8);
                String err = "Hugging Face Model Notice (HTTP 410): The requested model is deprecated and no longer supported on the serverless inference router.";
                ImageGenerationResponse errResp = ImageGenerationResponse.error(err, modelId, modelId, "Hugging Face", request.getPrompt(), duration);
                errResp.setErrorCategory(ImageErrorCategory.MODEL_UNAVAILABLE.name());
                errResp.setErrorReason("Model is deprecated on serverless router (HTTP 410).");
                errResp.setErrorNextStep("Select another image model or use Free Diffusion.");
                errResp.setDocUrl("https://huggingface.co/docs/inference-endpoints");
                errResp.setCanRetry(false);
                errResp.setCanFallback(true);
                errResp.setFallbackModelId("flux-schnell-free");
                errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
                errResp.setFallbackProvider("Pollinations (Free Hosted)");
                errResp.setActualModelId(modelId);
                errResp.setActualModelName(modelId);
                errResp.setActualProvider("Hugging Face");
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            if (response.statusCode() != 200) {
                String rawErr = new String(response.body(), StandardCharsets.UTF_8);
                String err = "Hugging Face Image Provider Error (HTTP " + response.statusCode() + "): " + rawErr;
                ImageGenerationResponse errResp = ImageGenerationResponse.error(err, modelId, modelId, "Hugging Face", request.getPrompt(), duration);
                boolean isAuth = response.statusCode() == 401 || response.statusCode() == 403;
                errResp.setErrorCategory(isAuth ? ImageErrorCategory.AUTHENTICATION_FAILED.name() : ImageErrorCategory.PROVIDER_UNAVAILABLE.name());
                errResp.setErrorReason(isAuth ? "HF_TOKEN is invalid or expired." : ("Server error HTTP " + response.statusCode()));
                errResp.setErrorNextStep(isAuth ? "Update HF_TOKEN in environment variables." : "Retry or switch models.");
                errResp.setDocUrl("https://huggingface.co/settings/tokens");
                errResp.setCanRetry(!isAuth);
                errResp.setCanFallback(true);
                errResp.setFallbackModelId("flux-schnell-free");
                errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
                errResp.setFallbackProvider("Pollinations (Free Hosted)");
                errResp.setActualModelId(modelId);
                errResp.setActualModelName(modelId);
                errResp.setActualProvider("Hugging Face");
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            String contentType = response.headers().firstValue("Content-Type").orElse("");
            String dataUrl = null;

            if (contentType.startsWith("image/") || (response.body().length > 0 && (response.body()[0] == (byte) 0xFF || response.body()[0] == (byte) 0x89))) {
                String mime = contentType.startsWith("image/") ? contentType : "image/jpeg";
                String base64 = Base64.getEncoder().encodeToString(response.body());
                dataUrl = "data:" + mime + ";base64," + base64;
            } else {
                String jsonStr = new String(response.body(), StandardCharsets.UTF_8);
                JsonNode root = objectMapper.readTree(jsonStr);
                if (root.has("data") && root.get("data").isArray() && root.get("data").size() > 0) {
                    JsonNode first = root.get("data").get(0);
                    if (first.has("b64_json")) {
                        dataUrl = "data:image/png;base64," + first.get("b64_json").asText();
                    } else if (first.has("url")) {
                        dataUrl = first.get("url").asText();
                    }
                } else if (root.has("images") && root.get("images").isArray() && root.get("images").size() > 0) {
                    dataUrl = root.get("images").get(0).asText();
                    if (!dataUrl.startsWith("data:") && !dataUrl.startsWith("http")) {
                        dataUrl = "data:image/png;base64," + dataUrl;
                    }
                }
            }

            if (dataUrl == null) {
                ImageGenerationResponse errResp = ImageGenerationResponse.error("Unable to parse image payload from Hugging Face response.", modelId, modelId, "Hugging Face", request.getPrompt(), duration);
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            String imageId = "img-hf-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
            ImageGenerationResponse success = ImageGenerationResponse.success(
                    imageId,
                    modelId,
                    modelId,
                    "Hugging Face",
                    request.getPrompt(),
                    spec.getNegativePrompt(),
                    dataUrl,
                    spec.getWidth(),
                    spec.getHeight(),
                    spec.getAspectRatio(),
                    Instant.now().toString(),
                    duration
            );
            success.setEnhancedPrompt(spec.getModelSpecificPrompt());
            success.setStructuredSpec(spec.toMap());
            return success;

        } catch (Exception e) {
            log.error("[HuggingFaceImageProvider] Error for model {}: {}", modelId, e.getMessage());
            long duration = System.currentTimeMillis() - startTime;
            ImageGenerationResponse errResp = ImageGenerationResponse.error(e.getMessage(), modelId, modelId, "Hugging Face", request.getPrompt(), duration);
            boolean isTimeout = e instanceof java.net.http.HttpTimeoutException || (e.getMessage() != null && e.getMessage().toLowerCase().contains("timeout"));
            errResp.setErrorCategory(isTimeout ? ImageErrorCategory.NETWORK_TIMEOUT.name() : ImageErrorCategory.EXCEPTION.name());
            errResp.setErrorReason(isTimeout ? "Connection to Hugging Face router timed out." : e.getMessage());
            errResp.setErrorNextStep("Check network connectivity and retry.");
            errResp.setDocUrl("https://huggingface.co/docs");
            errResp.setCanRetry(true);
            errResp.setCanFallback(true);
            errResp.setFallbackModelId("flux-schnell-free");
            errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
            errResp.setFallbackProvider("Pollinations (Free Hosted)");
            errResp.setActualModelId(modelId);
            errResp.setActualModelName(modelId);
            errResp.setActualProvider("Hugging Face");
            errResp.setStructuredSpec(spec.toMap());
            return errResp;
        }
    }

    @Override
    public ImageProviderStatusCache.ProviderHealthStatus checkConnectivity(String modelId) {
        String mId = (modelId != null && !modelId.isBlank()) ? modelId : "black-forest-labs/FLUX.1-schnell";
        String token = getEffectiveToken();
        if (token == null || token.isBlank()) {
            ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNCONFIGURED");
            s.setErrorCategory(ImageErrorCategory.AUTHENTICATION_FAILED);
            s.setErrorMessage("HF_TOKEN is not configured.");
            s.setErrorReason("Missing Hugging Face token.");
            s.setErrorNextStep("Set HF_TOKEN in environment variables.");
            s.setDocUrl("https://huggingface.co/settings/tokens");
            s.setCanRetry(false);
            return s;
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://huggingface.co/api/models/" + mId))
                    .header("Authorization", "Bearer " + token)
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 200) {
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "AVAILABLE");
                s.setErrorMessage("Hugging Face model repository verified.");
                s.setCanRetry(true);
                return s;
            } else if (response.statusCode() == 401 || response.statusCode() == 403) {
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNAVAILABLE");
                s.setErrorCategory(ImageErrorCategory.AUTHENTICATION_FAILED);
                s.setErrorMessage("HF_TOKEN invalid or unauthorized (HTTP " + response.statusCode() + ").");
                s.setErrorReason("Token authentication failed.");
                s.setErrorNextStep("Update HF_TOKEN in environment variables.");
                s.setDocUrl("https://huggingface.co/settings/tokens");
                s.setCanRetry(false);
                return s;
            } else {
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNAVAILABLE");
                s.setErrorCategory(ImageErrorCategory.MODEL_UNAVAILABLE);
                s.setErrorMessage("Hugging Face model not found or unavailable (HTTP " + response.statusCode() + ").");
                s.setErrorReason("Model unavailable.");
                s.setErrorNextStep("Select another supported model.");
                s.setCanRetry(false);
                return s;
            }
        } catch (Exception e) {
            ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNAVAILABLE");
            s.setErrorCategory(ImageErrorCategory.NETWORK_TIMEOUT);
            s.setErrorMessage("Probe failed: " + e.getMessage());
            s.setErrorReason("Connection timeout.");
            s.setErrorNextStep("Check network connection.");
            s.setCanRetry(true);
            return s;
        }
    }
}
