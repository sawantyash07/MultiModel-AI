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
public class OpenAiImageProvider implements ImageProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenAiImageProvider.class);

    private static final List<String> SUPPORTED = List.of(
            "gpt-image-2.5-flare",
            "gpt-image-2.5-sunburst",
            "dall-e-3"
    );

    @Value("${openai.api-key:}")
    private String configuredKey;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.ALWAYS)
            .connectTimeout(Duration.ofSeconds(45))
            .build();

    public String getEffectiveApiKey() {
        String env = System.getenv("OPENAI_API_KEY");
        if (env != null && !env.isBlank()) return env.trim();
        if (configuredKey != null && !configuredKey.isBlank() && !configuredKey.startsWith("${")) {
            return configuredKey.trim();
        }
        return null;
    }

    @Override
    public String getProviderId() {
        return "openai";
    }

    @Override
    public String getDisplayName() {
        return "OpenAI (GPT Image 2.5)";
    }

    @Override
    public boolean supportsModel(String modelId) {
        if (modelId == null) return false;
        String m = modelId.toLowerCase();
        return m.contains("gpt-image") || m.contains("sunburst") || m.contains("flare") || m.contains("dall-e");
    }

    @Override
    public List<String> getSupportedModels() {
        return SUPPORTED;
    }

    @Override
    public boolean isAvailable() {
        return getEffectiveApiKey() != null;
    }

    @Override
    public String getAccessRequirement() {
        return "OpenAI API Key with Active Credit Balance (platform.openai.com)";
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
        String modelId = request.getModelId() != null ? request.getModelId() : "gpt-image-2.5-flare";
        String apiKey = getEffectiveApiKey();

        if (apiKey == null || apiKey.isBlank()) {
            String err = "OpenAI API Key (OPENAI_API_KEY) is not configured in backend environment variables.";
            ImageGenerationResponse errResp = ImageGenerationResponse.error(err, modelId, modelId, "OpenAI", request.getPrompt(), 0);
            errResp.setErrorCategory(ImageErrorCategory.AUTHENTICATION_FAILED.name());
            errResp.setErrorReason("Missing OPENAI_API_KEY credential.");
            errResp.setErrorNextStep("Set OPENAI_API_KEY in environment variables or application.properties.");
            errResp.setDocUrl("https://platform.openai.com/api-keys");
            errResp.setCanRetry(false);
            errResp.setCanFallback(true);
            errResp.setFallbackModelId("flux-schnell-free");
            errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
            errResp.setFallbackProvider("Pollinations (Free Hosted)");
            errResp.setActualModelId(modelId);
            errResp.setActualModelName(modelId);
            errResp.setActualProvider("OpenAI");
            return errResp;
        }

        String prompt = spec.getModelSpecificPrompt() != null && !spec.getModelSpecificPrompt().isBlank()
                ? spec.getModelSpecificPrompt()
                : request.getPrompt();

        try {
            // Map dimensions to OpenAI supported sizes: 1024x1024, 1024x1792, 1792x1024
            String size = "1024x1024";
            if ("16:9".equals(spec.getAspectRatio())) {
                size = "1792x1024";
            } else if ("9:16".equals(spec.getAspectRatio())) {
                size = "1024x1792";
            }

            Map<String, Object> reqBody = new LinkedHashMap<>();
            reqBody.put("model", modelId);
            reqBody.put("prompt", prompt);
            reqBody.put("size", size);

            String jsonPayload = objectMapper.writeValueAsString(reqBody);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.openai.com/v1/images/generations"))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            long duration = System.currentTimeMillis() - startTime;

            if (response.statusCode() == 429) {
                String raw = response.body();
                boolean isZeroCredits = raw.contains("credit_balance_exhausted") || raw.contains("insufficient_quota");
                String err = isZeroCredits
                        ? "OpenAI Billing Notice (HTTP 429 Insufficient Quota): You have no remaining credits on your OpenAI account. Add credits at platform.openai.com/settings/organization/billing."
                        : "OpenAI Rate Limit Notice (HTTP 429): Request rate limit exceeded.";
                log.warn("[OpenAiImageProvider] {}", err);
                ImageGenerationResponse errResp = ImageGenerationResponse.error(err, modelId, modelId, "OpenAI", request.getPrompt(), duration);
                errResp.setErrorCategory(isZeroCredits ? ImageErrorCategory.ZERO_QUOTA.name() : ImageErrorCategory.RATE_LIMITED.name());
                errResp.setErrorReason(isZeroCredits
                        ? "You have 0 credit balance on your OpenAI account (`credit_balance_exhausted`)."
                        : "OpenAI requests-per-minute or tokens-per-minute rate limit reached.");
                errResp.setErrorNextStep(isZeroCredits
                        ? "Add credits at platform.openai.com/settings/organization/billing or switch to a free model."
                        : "Wait for the OpenAI rate limit cooldown to expire.");
                errResp.setDocUrl("https://platform.openai.com/settings/organization/billing");
                errResp.setCanRetry(!isZeroCredits);
                errResp.setCooldownSeconds(isZeroCredits ? 600 : 60);
                errResp.setCanFallback(true);
                errResp.setFallbackModelId("flux-schnell-free");
                errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
                errResp.setFallbackProvider("Pollinations (Free Hosted)");
                errResp.setActualModelId(modelId);
                errResp.setActualModelName(modelId);
                errResp.setActualProvider("OpenAI");
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            if (response.statusCode() != 200) {
                String raw = response.body();
                String err = "OpenAI Image Provider Error (HTTP " + response.statusCode() + "): " + raw;
                log.error("[OpenAiImageProvider] {}", err);
                ImageGenerationResponse errResp = ImageGenerationResponse.error(err, modelId, modelId, "OpenAI", request.getPrompt(), duration);
                
                ImageErrorCategory cat;
                String reason;
                String nextStep;
                String docUrl;
                boolean canRetry = false;
                
                if (response.statusCode() == 401 || response.statusCode() == 403) {
                    cat = ImageErrorCategory.AUTHENTICATION_FAILED;
                    reason = "OpenAI API key is invalid, expired, or unauthorized.";
                    nextStep = "Check and update OPENAI_API_KEY in backend environment variables.";
                    docUrl = "https://platform.openai.com/api-keys";
                } else if (response.statusCode() == 404) {
                    cat = ImageErrorCategory.MODEL_UNAVAILABLE;
                    reason = "The requested model ID is not available on this OpenAI account.";
                    nextStep = "Select another supported OpenAI model (e.g. gpt-image-2.5-flare or dall-e-3).";
                    docUrl = "https://platform.openai.com/docs/models";
                } else if (response.statusCode() >= 500) {
                    cat = ImageErrorCategory.PROVIDER_UNAVAILABLE;
                    reason = "OpenAI servers are temporarily unavailable (HTTP " + response.statusCode() + ").";
                    nextStep = "Retry shortly or switch models.";
                    docUrl = "https://status.openai.com";
                    canRetry = true;
                } else {
                    cat = ImageErrorCategory.MODEL_UNAVAILABLE;
                    reason = "OpenAI returned HTTP " + response.statusCode();
                    nextStep = "Inspect model parameters or switch models.";
                    docUrl = "https://platform.openai.com/docs/guides/image-generation";
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
                errResp.setActualProvider("OpenAI");
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            JsonNode root = objectMapper.readTree(response.body());
            String dataUrl = null;
            String revisedPrompt = null;

            if (root.has("data") && root.get("data").isArray() && root.get("data").size() > 0) {
                JsonNode first = root.get("data").get(0);
                if (first.has("revised_prompt")) {
                    revisedPrompt = first.get("revised_prompt").asText();
                }
                if (first.has("b64_json")) {
                    dataUrl = "data:image/png;base64," + first.get("b64_json").asText();
                } else if (first.has("url")) {
                    String imgUrl = first.get("url").asText();
                    try {
                        HttpRequest dlReq = HttpRequest.newBuilder()
                                .uri(URI.create(imgUrl))
                                .timeout(Duration.ofSeconds(20))
                                .GET()
                                .build();
                        HttpResponse<byte[]> dlRes = httpClient.send(dlReq, HttpResponse.BodyHandlers.ofByteArray());
                        if (dlRes.statusCode() == 200 && dlRes.body().length > 0) {
                            String mime = dlRes.headers().firstValue("Content-Type").orElse("image/png");
                            dataUrl = "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(dlRes.body());
                        } else {
                            dataUrl = imgUrl;
                        }
                    } catch (Exception dlEx) {
                        dataUrl = imgUrl;
                    }
                }
            }

            if (dataUrl == null) {
                String err = "Failed to extract image output from OpenAI response payload.";
                ImageGenerationResponse errResp = ImageGenerationResponse.error(err, modelId, modelId, "OpenAI", request.getPrompt(), duration);
                errResp.setErrorCategory(ImageErrorCategory.INVALID_RESPONSE.name());
                errResp.setErrorReason("Response did not contain valid b64_json or image url.");
                errResp.setErrorNextStep("Retry request or use Free Diffusion.");
                errResp.setCanFallback(true);
                errResp.setFallbackModelId("flux-schnell-free");
                errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
                errResp.setFallbackProvider("Pollinations (Free Hosted)");
                errResp.setActualModelId(modelId);
                errResp.setActualModelName(modelId);
                errResp.setActualProvider("OpenAI");
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            String imageId = "img-openai-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
            ImageGenerationResponse success = ImageGenerationResponse.success(
                    imageId,
                    modelId,
                    modelId,
                    "OpenAI",
                    request.getPrompt(),
                    spec.getNegativePrompt(),
                    dataUrl,
                    spec.getWidth(),
                    spec.getHeight(),
                    spec.getAspectRatio(),
                    Instant.now().toString(),
                    duration
            );
            success.setEnhancedPrompt(revisedPrompt != null ? revisedPrompt : spec.getModelSpecificPrompt());
            success.setStructuredSpec(spec.toMap());
            success.setActualModelId(modelId);
            success.setActualModelName(modelId);
            success.setActualProvider("OpenAI");
            return success;

        } catch (Exception e) {
            log.error("[OpenAiImageProvider] Error for model {}: {}", modelId, e.getMessage());
            long duration = System.currentTimeMillis() - startTime;
            ImageGenerationResponse errResp = ImageGenerationResponse.error(e.getMessage(), modelId, modelId, "OpenAI", request.getPrompt(), duration);
            boolean isTimeout = e instanceof java.net.http.HttpTimeoutException || (e.getMessage() != null && e.getMessage().toLowerCase().contains("timeout"));
            errResp.setErrorCategory(isTimeout ? ImageErrorCategory.NETWORK_TIMEOUT.name() : ImageErrorCategory.EXCEPTION.name());
            errResp.setErrorReason(isTimeout ? "Connection to OpenAI API timed out." : e.getMessage());
            errResp.setErrorNextStep("Check network connectivity and retry.");
            errResp.setDocUrl("https://platform.openai.com/docs");
            errResp.setCanRetry(true);
            errResp.setCanFallback(true);
            errResp.setFallbackModelId("flux-schnell-free");
            errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
            errResp.setFallbackProvider("Pollinations (Free Hosted)");
            errResp.setActualModelId(modelId);
            errResp.setActualModelName(modelId);
            errResp.setActualProvider("OpenAI");
            errResp.setStructuredSpec(spec.toMap());
            return errResp;
        }
    }

    @Override
    public ImageProviderStatusCache.ProviderHealthStatus checkConnectivity(String modelId) {
        String mId = (modelId != null && !modelId.isBlank()) ? modelId : "gpt-image-2.5-flare";
        String apiKey = getEffectiveApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNCONFIGURED");
            s.setErrorCategory(ImageErrorCategory.AUTHENTICATION_FAILED);
            s.setErrorMessage("OPENAI_API_KEY is not configured.");
            s.setErrorReason("Missing OpenAI credential.");
            s.setErrorNextStep("Set OPENAI_API_KEY in environment variables or application.properties.");
            s.setDocUrl("https://platform.openai.com/api-keys");
            s.setCanRetry(false);
            return s;
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.openai.com/v1/models/" + mId))
                    .header("Authorization", "Bearer " + apiKey)
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 200) {
                // Now test image generations balance with a minimal probe or report model verified
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "AVAILABLE");
                s.setErrorMessage("OpenAI model endpoint verified and available.");
                s.setCanRetry(true);
                return s;
            } else if (response.statusCode() == 429) {
                String b = response.body();
                boolean isZero = b.contains("credit_balance_exhausted") || b.contains("insufficient_quota");
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, isZero ? "ZERO_QUOTA" : "RATE_LIMITED");
                s.setErrorCategory(isZero ? ImageErrorCategory.ZERO_QUOTA : ImageErrorCategory.RATE_LIMITED);
                s.setErrorMessage(isZero ? "OpenAI Quota Notice: Zero credit balance remaining." : "OpenAI Rate Limited.");
                s.setErrorReason(isZero ? "Account credit balance exhausted." : "Rate limit exceeded.");
                s.setErrorNextStep("Add credits at platform.openai.com/settings/organization/billing.");
                s.setDocUrl("https://platform.openai.com/settings/organization/billing");
                s.setCanRetry(!isZero);
                return s;
            } else if (response.statusCode() == 401 || response.statusCode() == 403) {
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNAVAILABLE");
                s.setErrorCategory(ImageErrorCategory.AUTHENTICATION_FAILED);
                s.setErrorMessage("OpenAI Authentication Error (HTTP " + response.statusCode() + ")");
                s.setErrorReason("API Key invalid or unauthorized.");
                s.setErrorNextStep("Verify OPENAI_API_KEY.");
                s.setDocUrl("https://platform.openai.com/api-keys");
                s.setCanRetry(false);
                return s;
            } else {
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNAVAILABLE");
                s.setErrorCategory(ImageErrorCategory.MODEL_UNAVAILABLE);
                s.setErrorMessage("OpenAI Error (HTTP " + response.statusCode() + "): " + response.body());
                s.setErrorReason("Model endpoint unavailable.");
                s.setErrorNextStep("Select another supported model.");
                s.setCanRetry(false);
                return s;
            }
        } catch (Exception e) {
            ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNAVAILABLE");
            s.setErrorCategory(ImageErrorCategory.NETWORK_TIMEOUT);
            s.setErrorMessage("OpenAI probe failed: " + e.getMessage());
            s.setErrorReason("Connection timeout or network failure.");
            s.setErrorNextStep("Verify network connectivity.");
            s.setCanRetry(true);
            return s;
        }
    }
}
