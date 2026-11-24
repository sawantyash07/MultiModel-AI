package com.coderarmy.ragsupport.hub.service.provider;

import com.coderarmy.ragsupport.hub.model.ImageErrorCategory;
import com.coderarmy.ragsupport.hub.model.ImageGenerationRequest;
import com.coderarmy.ragsupport.hub.model.ImageGenerationResponse;
import com.coderarmy.ragsupport.hub.service.PromptUnderstandingService.PromptSpecification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Component
public class PollinationsImageProvider implements ImageProvider {

    private static final Logger log = LoggerFactory.getLogger(PollinationsImageProvider.class);

    private static final List<String> SUPPORTED = List.of(
            "flux-schnell-free",
            "flux-realism",
            "flux-anime",
            "flux-3d",
            "turbo"
    );

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.ALWAYS)
            .connectTimeout(Duration.ofSeconds(45))
            .build();

    @Override
    public String getProviderId() {
        return "pollinations";
    }

    @Override
    public String getDisplayName() {
        return "Pollinations AI (FLUX Diffusion)";
    }

    @Override
    public boolean supportsModel(String modelId) {
        if (modelId == null) return false;
        String m = modelId.toLowerCase();
        return m.equals("flux-schnell-free") || m.contains("pollinations") || m.equals("flux") || m.contains("flux-realism") || m.contains("flux-anime") || m.contains("flux-3d");
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
        return "100% Free Hosted (Zero-Cost / No Account Required)";
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
        String modelId = request.getModelId() != null ? request.getModelId() : "flux-schnell-free";
        String prompt = spec.getModelSpecificPrompt() != null && !spec.getModelSpecificPrompt().isBlank()
                ? spec.getModelSpecificPrompt()
                : request.getPrompt();

        int width = spec.getWidth() > 0 ? spec.getWidth() : 1024;
        int height = spec.getHeight() > 0 ? spec.getHeight() : 1024;
        long seed = request.getSeed() != null ? request.getSeed() : (long) (Math.random() * 1_000_000_000L);

        // Map model parameter for Pollinations API
        String pollinationsModel = "flux";
        if (modelId.contains("realism")) pollinationsModel = "flux-realism";
        else if (modelId.contains("anime")) pollinationsModel = "flux-anime";
        else if (modelId.contains("3d")) pollinationsModel = "flux-3d";
        else if (modelId.contains("turbo")) pollinationsModel = "turbo";

        try {
            String encodedPrompt = URLEncoder.encode(prompt, StandardCharsets.UTF_8);

            StringBuilder urlBuilder = new StringBuilder("https://image.pollinations.ai/prompt/")
                    .append(encodedPrompt)
                    .append("?width=").append(width)
                    .append("&height=").append(height)
                    .append("&seed=").append(seed)
                    .append("&nologo=true")
                    .append("&model=").append(pollinationsModel)
                    .append("&enhance=").append(Boolean.TRUE.equals(request.getEnhancePrompt()) ? "true" : "false");

            // Negative prompt preservation
            String negPrompt = (request.getNegativePrompt() != null && !request.getNegativePrompt().isBlank())
                    ? request.getNegativePrompt().trim()
                    : spec.getNegativePrompt();

            if (negPrompt != null && !negPrompt.isBlank()) {
                urlBuilder.append("&negative_prompt=").append(URLEncoder.encode(negPrompt, StandardCharsets.UTF_8));
            }

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(urlBuilder.toString()))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) YashAI/3.0")
                    .header("Accept", "image/jpeg, image/png, image/*, */*")
                    .timeout(Duration.ofSeconds(90))
                    .GET()
                    .build();

            HttpResponse<byte[]> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofByteArray());
            long duration = System.currentTimeMillis() - startTime;

            // Handle 402 FREE_LIMIT cooldown
            if (response.statusCode() == 402) {
                String respStr = new String(response.body(), StandardCharsets.UTF_8);
                int retrySec = parseRetrySeconds(response, respStr);
                if (retrySec > 0 && retrySec <= 55) {
                    log.info("[PollinationsImageProvider] Cooldown active ({}s). Waiting to complete generation...", retrySec);
                    try {
                        Thread.sleep((retrySec + 1) * 1000L);
                        response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofByteArray());
                        duration = System.currentTimeMillis() - startTime;
                    } catch (InterruptedException ignored) {}
                }
            }

            if (response.statusCode() == 402) {
                String errMsg = "⏱️ **Free Tier Cooldown**: The hosted diffusion service enforces a brief cooldown between requests per IP address. Please wait a few seconds and click **Retry Request**.";
                ImageGenerationResponse errResp = ImageGenerationResponse.error(errMsg, modelId, "FLUX.1 [schnell] (Free Tier Hosted)", "Pollinations (Free Hosted)", request.getPrompt(), duration);
                errResp.setErrorCategory(ImageErrorCategory.RATE_LIMITED.name());
                errResp.setErrorReason("IP rate limit cooldown active on free hosted tier.");
                errResp.setErrorNextStep("Wait a few seconds for the cooldown window to reset, then click Retry.");
                errResp.setDocUrl("https://pollinations.ai");
                errResp.setCanRetry(true);
                errResp.setCooldownSeconds(30);
                errResp.setActualModelId("sana-free");
                errResp.setActualModelName("Sana (via Pollinations)");
                errResp.setActualProvider("Pollinations (Free Hosted)");
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            if (response.statusCode() != 200 || response.body().length == 0) {
                String rawErr = response.body().length > 0 ? new String(response.body(), StandardCharsets.UTF_8) : "";
                String errMsg = "Image generation service returned status " + response.statusCode() + (rawErr.isBlank() ? "" : ": " + rawErr);
                ImageGenerationResponse errResp = ImageGenerationResponse.error(errMsg, modelId, "FLUX.1 [schnell]", "Pollinations (Free Hosted)", request.getPrompt(), duration);
                errResp.setErrorCategory(ImageErrorCategory.PROVIDER_UNAVAILABLE.name());
                errResp.setErrorReason("Free diffusion service temporarily unreachable (HTTP " + response.statusCode() + ").");
                errResp.setErrorNextStep("Retry shortly.");
                errResp.setCanRetry(true);
                errResp.setActualModelId("flux-schnell-free");
                errResp.setActualModelName("FLUX.1 [schnell] (Free Tier Hosted)");
                errResp.setActualProvider("Pollinations (Free Hosted)");
                errResp.setStructuredSpec(spec.toMap());
                return errResp;
            }

            byte[] imageBytes = response.body();
            String contentType = response.headers().firstValue("Content-Type").orElse("image/jpeg");
            String mime = contentType.startsWith("image/") ? contentType : "image/jpeg";
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String dataUrl = "data:" + mime + ";base64," + base64Image;

            // Detect actual model used from response headers to guarantee truthful attribution
            String actualModelHeader = response.headers().firstValue("x-model-used").orElse(null);
            String actualModelId = "flux-schnell-free";
            String actualModelName = "FLUX.1 [schnell] (Free Tier Hosted)";
            if (actualModelHeader != null && !actualModelHeader.isBlank()) {
                String trimmed = actualModelHeader.trim().toLowerCase();
                if ("sana".equals(trimmed)) {
                    actualModelId = "sana-free";
                    actualModelName = "Sana (0.6B Mobile Edge Diffusion via Pollinations)";
                } else if ("flux".equals(trimmed)) {
                    actualModelId = "flux-schnell-free";
                    actualModelName = "FLUX.1 [schnell] (via Pollinations)";
                } else {
                    actualModelId = "pollinations-" + trimmed;
                    actualModelName = actualModelHeader + " (via Pollinations)";
                }
            }

            String imageId = "img-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
            ImageGenerationResponse success = ImageGenerationResponse.success(
                    imageId,
                    modelId,
                    actualModelName,
                    "Pollinations (Free Hosted)",
                    request.getPrompt(),
                    negPrompt,
                    dataUrl,
                    width,
                    height,
                    spec.getAspectRatio(),
                    Instant.now().toString(),
                    duration
            );
            success.setActualModelId(actualModelId);
            success.setActualModelName(actualModelName);
            success.setActualProvider("Pollinations (Free Hosted)");
            success.setEnhancedPrompt(spec.getModelSpecificPrompt());
            success.setStructuredSpec(spec.toMap());
            success.setSeed(seed);
            return success;

        } catch (Exception e) {
            log.error("[PollinationsImageProvider] Error for model {}: {}", modelId, e.getMessage());
            long duration = System.currentTimeMillis() - startTime;
            ImageGenerationResponse errResp = ImageGenerationResponse.error(e.getMessage(), modelId, "FLUX.1 [schnell]", "Pollinations", request.getPrompt(), duration);
            boolean isTimeout = e instanceof java.net.http.HttpTimeoutException || (e.getMessage() != null && e.getMessage().toLowerCase().contains("timeout"));
            errResp.setErrorCategory(isTimeout ? ImageErrorCategory.NETWORK_TIMEOUT.name() : ImageErrorCategory.EXCEPTION.name());
            errResp.setErrorReason(isTimeout ? "Connection timed out." : e.getMessage());
            errResp.setErrorNextStep("Check network connection and retry.");
            errResp.setCanRetry(true);
            errResp.setStructuredSpec(spec.toMap());
            return errResp;
        }
    }

    @Override
    public ImageProviderStatusCache.ProviderHealthStatus checkConnectivity(String modelId) {
        String mId = (modelId != null && !modelId.isBlank()) ? modelId : "flux-schnell-free";
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://image.pollinations.ai/models"))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 200) {
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "AVAILABLE");
                s.setErrorMessage("Pollinations Free Tier active (served via Sana / FLUX Edge).");
                s.setCanRetry(true);
                return s;
            } else {
                ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNAVAILABLE");
                s.setErrorCategory(ImageErrorCategory.PROVIDER_UNAVAILABLE);
                s.setErrorMessage("Pollinations status HTTP " + response.statusCode());
                s.setCanRetry(true);
                return s;
            }
        } catch (Exception e) {
            ImageProviderStatusCache.ProviderHealthStatus s = new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), mId, "UNAVAILABLE");
            s.setErrorCategory(ImageErrorCategory.NETWORK_TIMEOUT);
            s.setErrorMessage("Pollinations probe failed: " + e.getMessage());
            s.setCanRetry(true);
            return s;
        }
    }

    private int parseRetrySeconds(HttpResponse<?> response, String json) {
        if (response != null) {
            Optional<String> header = response.headers().firstValue("Retry-After");
            if (header.isEmpty()) {
                header = response.headers().firstValue("retry-after");
            }
            if (header.isPresent()) {
                try {
                    return Integer.parseInt(header.get().trim());
                } catch (Exception ignored) {}
            }
        }
        if (json == null) return -1;
        try {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?:retry[\\s_-]*(?:in|after)|wait)[\\s_:-]*(\\d+)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(json);
            if (m.find()) {
                return Integer.parseInt(m.group(1));
            }
            java.util.regex.Matcher m2 = java.util.regex.Pattern.compile("(\\d+)\\s*(?:s|seconds?|sec)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(json);
            if (m2.find()) {
                return Integer.parseInt(m2.group(1));
            }
        } catch (Exception ignored) {}
        return -1;
    }
}
