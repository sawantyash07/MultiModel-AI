package com.coderarmy.ragsupport.hub.service.provider;

import com.coderarmy.ragsupport.hub.model.ImageErrorCategory;
import com.coderarmy.ragsupport.hub.model.ImageGenerationRequest;
import com.coderarmy.ragsupport.hub.model.ImageGenerationResponse;
import com.coderarmy.ragsupport.hub.service.PromptUnderstandingService.PromptSpecification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class ImageProviderRegistry {

    private static final Logger log = LoggerFactory.getLogger(ImageProviderRegistry.class);

    private final List<ImageProvider> providers;
    private final PollinationsImageProvider defaultFallbackProvider;
    private final ImageProviderStatusCache statusCache;

    @Autowired
    public ImageProviderRegistry(
            List<ImageProvider> providers,
            PollinationsImageProvider defaultFallbackProvider,
            ImageProviderStatusCache statusCache
    ) {
        this.providers = providers;
        this.defaultFallbackProvider = defaultFallbackProvider;
        this.statusCache = statusCache;
    }

    public ImageProvider resolveProvider(String modelId) {
        if (modelId != null) {
            for (ImageProvider p : providers) {
                if (p.supportsModel(modelId)) {
                    return p;
                }
            }
        }
        return defaultFallbackProvider;
    }

    public ImageProvider resolveProviderById(String providerId) {
        if (providerId != null) {
            for (ImageProvider p : providers) {
                if (p.getProviderId().equalsIgnoreCase(providerId.trim())) {
                    return p;
                }
            }
        }
        return null;
    }

    public ImageProviderStatusCache.ProviderHealthStatus checkProvider(String providerId, String modelId) {
        ImageProvider provider = resolveProviderById(providerId);
        if (provider == null && modelId != null) {
            provider = resolveProvider(modelId);
        }
        if (provider == null) {
            provider = defaultFallbackProvider;
        }

        String targetModel = (modelId != null && !modelId.isBlank()) ? modelId : provider.getSupportedModels().get(0);
        log.info("[ImageProviderRegistry] Executing live health check for provider '{}' model '{}'", provider.getProviderId(), targetModel);

        // Invalidate stale status before live check
        statusCache.invalidate(provider.getProviderId(), targetModel);

        ImageProviderStatusCache.ProviderHealthStatus liveStatus = provider.checkConnectivity(targetModel);
        if ("AVAILABLE".equalsIgnoreCase(liveStatus.getStatus())) {
            statusCache.recordSuccess(provider.getProviderId(), targetModel);
        } else {
            statusCache.recordFailure(
                    provider.getProviderId(),
                    targetModel,
                    liveStatus.getErrorCategory(),
                    liveStatus.getErrorMessage(),
                    liveStatus.getErrorReason(),
                    liveStatus.getErrorNextStep(),
                    liveStatus.getDocUrl()
            );
        }

        return liveStatus;
    }

    public ImageGenerationResponse executeWithFallback(ImageGenerationRequest request, PromptSpecification spec, long startTime) {
        String targetModelId = request.getModelId() != null ? request.getModelId() : "flux-schnell-free";
        ImageProvider provider = resolveProvider(targetModelId);
        boolean userAllowedFallback = Boolean.TRUE.equals(request.getAllowFallback());

        // Circuit Breaker: Check if provider/model is currently in cooldown for ZERO_QUOTA or BILLING_REQUIRED
        if (provider != defaultFallbackProvider && statusCache.isBlocked(provider.getProviderId(), targetModelId)) {
            ImageProviderStatusCache.ProviderHealthStatus cached = statusCache.getStatus(provider.getProviderId(), targetModelId);
            log.warn("[ImageProviderRegistry] Provider '{}' model '{}' is in active cooldown [status={}]",
                    provider.getProviderId(), targetModelId, cached != null ? cached.getStatus() : "BLOCKED");

            if (userAllowedFallback) {
                log.info("[ImageProviderRegistry] Auto-routing to fallback provider '{}' due to active zero-quota cooldown...",
                        defaultFallbackProvider.getDisplayName());
                ImageGenerationResponse fallbackResponse = defaultFallbackProvider.generateImage(request, spec, startTime);
                if (fallbackResponse != null) {
                    fallbackResponse.setFallbackFrom(targetModelId);
                    if (fallbackResponse.getFallbackReason() == null) {
                        fallbackResponse.setFallbackReason(cached != null && cached.getErrorMessage() != null
                                ? cached.getErrorMessage()
                                : "Primary model has zero available quota on Free Tier (`limit: 0`). Auto-routed to free diffusion.");
                    }
                    return fallbackResponse;
                }
            }

            // Return fast diagnostic response without network delay or redundant API failure
            long duration = System.currentTimeMillis() - startTime;
            String err = (cached != null && cached.getErrorMessage() != null)
                    ? cached.getErrorMessage()
                    : "Model quota is zero (`limit: 0`) on Free Tier. Pay-As-You-Go billing required.";
            ImageGenerationResponse errResp = ImageGenerationResponse.error(err, targetModelId, targetModelId, provider.getDisplayName(), request.getPrompt(), duration);
            errResp.setErrorCategory(cached != null && cached.getErrorCategory() != null ? cached.getErrorCategory().name() : ImageErrorCategory.ZERO_QUOTA.name());
            errResp.setErrorReason(cached != null ? cached.getErrorReason() : "Free Tier quota limit for image generation is 0.");
            errResp.setErrorNextStep(cached != null ? cached.getErrorNextStep() : "Link a Google Cloud Billing account or select an alternative model.");
            errResp.setDocUrl(cached != null ? cached.getDocUrl() : "https://ai.google.dev/gemini-api/docs/billing");
            errResp.setCanRetry(cached != null && cached.isCanRetry());
            errResp.setCooldownSeconds(cached != null ? cached.getRemainingCooldownSeconds() : 600);
            errResp.setCanFallback(true);
            errResp.setFallbackModelId("flux-schnell-free");
            errResp.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
            errResp.setFallbackProvider("Pollinations (Free Hosted)");
            errResp.setActualModelId(targetModelId);
            errResp.setActualModelName(targetModelId);
            errResp.setActualProvider(provider.getDisplayName());
            errResp.setStructuredSpec(spec.toMap());
            return errResp;
        }

        log.info("[ImageProviderRegistry] Dispatching model '{}' to provider '{}'", targetModelId, provider.getDisplayName());
        ImageGenerationResponse response = provider.generateImage(request, spec, startTime);

        // If primary provider succeeded, record health and return directly
        if ("SUCCESS".equalsIgnoreCase(response.getStatus()) && response.getImageDataUrl() != null) {
            statusCache.recordSuccess(provider.getProviderId(), targetModelId);
            return response;
        }

        // Primary provider failed - classify and record failure
        String originalError = response.getError() != null ? response.getError() : "Provider unavailable";
        ImageErrorCategory category = inferCategory(response.getErrorCategory(), originalError);
        response.setErrorCategory(category.name());

        statusCache.recordFailure(
                provider.getProviderId(),
                targetModelId,
                category,
                originalError,
                response.getErrorReason(),
                response.getErrorNextStep(),
                response.getDocUrl()
        );

        // Enforce honest fallback policy:
        // Only perform automatic failover if user explicitly permitted it via allowFallback=true
        if (userAllowedFallback && provider != defaultFallbackProvider) {
            log.warn("[ImageProviderRegistry] Primary provider '{}' failed for model '{}' ({}) - User permitted failover, initiating fallback...",
                    provider.getDisplayName(), targetModelId, originalError);

            ImageGenerationResponse fallbackResponse = defaultFallbackProvider.generateImage(request, spec, startTime);
            if ("SUCCESS".equalsIgnoreCase(fallbackResponse.getStatus()) && fallbackResponse.getImageDataUrl() != null) {
                fallbackResponse.setFallbackFrom(targetModelId);
                fallbackResponse.setFallbackReason(originalError);
                log.info("[ImageProviderRegistry] Failover succeeded via '{}' (actual: '{}')",
                        defaultFallbackProvider.getDisplayName(), fallbackResponse.getActualModelName());
                return fallbackResponse;
            }
        }

        // If fallback was not allowed or failed, preserve honest error details with explicit fallback options
        response.setCanFallback(provider != defaultFallbackProvider);
        response.setFallbackModelId("flux-schnell-free");
        response.setFallbackModelName("FLUX.1 [schnell] / Sana (Free Tier Hosted)");
        response.setFallbackProvider("Pollinations (Free Hosted)");
        if (response.getErrorReason() == null) {
            response.setErrorReason(category.getDescription());
        }
        if (response.getErrorNextStep() == null) {
            response.setErrorNextStep("Select an available model or link account billing.");
        }

        return response;
    }

    private ImageErrorCategory inferCategory(String explicitCategory, String errorText) {
        if (explicitCategory != null) {
            try {
                return ImageErrorCategory.valueOf(explicitCategory.trim().toUpperCase());
            } catch (Exception ignored) {}
        }
        String lower = errorText != null ? errorText.toLowerCase() : "";
        if (lower.contains("limit: 0") || lower.contains("credit_balance_exhausted") || lower.contains("zero quota")) {
            return ImageErrorCategory.ZERO_QUOTA;
        }
        if (lower.contains("429") || lower.contains("rate limit") || lower.contains("too many requests")) {
            return ImageErrorCategory.RATE_LIMITED;
        }
        if (lower.contains("402") || lower.contains("billing") || lower.contains("payment")) {
            return ImageErrorCategory.BILLING_REQUIRED;
        }
        if (lower.contains("401") || lower.contains("403") || lower.contains("auth") || lower.contains("token")) {
            return ImageErrorCategory.AUTHENTICATION_FAILED;
        }
        if (lower.contains("410") || lower.contains("deprecated") || lower.contains("not found") || lower.contains("404")) {
            return ImageErrorCategory.MODEL_UNAVAILABLE;
        }
        if (lower.contains("timeout") || lower.contains("timed out")) {
            return ImageErrorCategory.NETWORK_TIMEOUT;
        }
        if (lower.contains("500") || lower.contains("502") || lower.contains("503") || lower.contains("504")) {
            return ImageErrorCategory.PROVIDER_UNAVAILABLE;
        }
        return ImageErrorCategory.EXCEPTION;
    }

    public List<ImageProvider> getProviders() {
        return providers;
    }

    public ImageProviderStatusCache getStatusCache() {
        return statusCache;
    }
}
