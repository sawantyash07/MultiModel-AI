package com.coderarmy.ragsupport.hub.service.provider;

import com.coderarmy.ragsupport.hub.model.ImageErrorCategory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * High-performance circuit breaker and availability status cache for image-generation providers.
 * Enforces intelligent cooldowns on zero-quota, rate-limited, and billing-required states
 * without repeatedly rediscovering the same failure across chat sessions or wasting API quotas.
 * 
 * Strict Modality Isolation:
 * Associated exclusively with the "TEXT_TO_IMAGE" operation. Quota exhaustion or billing
 * requirements for image synthesis will NEVER disable or affect unrelated text-generation capabilities.
 */
@Component
public class ImageProviderStatusCache {

    private static final Logger log = LoggerFactory.getLogger(ImageProviderStatusCache.class);

    public static class ProviderHealthStatus {
        private String providerId;
        private String modelId;
        private String operation = "TEXT_TO_IMAGE";
        private String status; // "AVAILABLE", "ZERO_QUOTA", "RATE_LIMITED", "BILLING_REQUIRED", "UNAVAILABLE", "UNCONFIGURED"
        private ImageErrorCategory errorCategory;
        private String errorMessage;
        private String errorReason;
        private String errorNextStep;
        private String docUrl;
        private boolean canRetry;
        private Instant lastChecked;
        private Instant cooldownUntil;

        public ProviderHealthStatus() {}

        public ProviderHealthStatus(String providerId, String modelId, String status) {
            this.providerId = providerId;
            this.modelId = modelId;
            this.status = status;
            this.lastChecked = Instant.now();
        }

        public boolean isBlocked() {
            if ("AVAILABLE".equalsIgnoreCase(status)) return false;
            if (cooldownUntil == null) return false;
            return Instant.now().isBefore(cooldownUntil);
        }

        public int getRemainingCooldownSeconds() {
            if (cooldownUntil == null) return 0;
            long remaining = DurationBetween(Instant.now(), cooldownUntil);
            return (int) Math.max(0, remaining);
        }

        private long DurationBetween(Instant start, Instant end) {
            return java.time.Duration.between(start, end).toSeconds();
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("providerId", providerId);
            map.put("modelId", modelId);
            map.put("operation", operation);
            map.put("status", status);
            map.put("errorCategory", errorCategory != null ? errorCategory.name() : null);
            map.put("errorMessage", errorMessage);
            map.put("errorReason", errorReason);
            map.put("errorNextStep", errorNextStep);
            map.put("docUrl", docUrl);
            map.put("canRetry", canRetry);
            map.put("lastChecked", lastChecked != null ? lastChecked.toString() : null);
            map.put("cooldownUntil", cooldownUntil != null ? cooldownUntil.toString() : null);
            map.put("remainingCooldownSeconds", getRemainingCooldownSeconds());
            map.put("isBlocked", isBlocked());
            return map;
        }

        // Getters and Setters
        public String getProviderId() { return providerId; }
        public void setProviderId(String providerId) { this.providerId = providerId; }
        public String getModelId() { return modelId; }
        public void setModelId(String modelId) { this.modelId = modelId; }
        public String getOperation() { return operation; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public ImageErrorCategory getErrorCategory() { return errorCategory; }
        public void setErrorCategory(ImageErrorCategory errorCategory) { this.errorCategory = errorCategory; }
        public String getErrorMessage() { return errorMessage; }
        public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
        public String getErrorReason() { return errorReason; }
        public void setErrorReason(String errorReason) { this.errorReason = errorReason; }
        public String getErrorNextStep() { return errorNextStep; }
        public void setErrorNextStep(String errorNextStep) { this.errorNextStep = errorNextStep; }
        public String getDocUrl() { return docUrl; }
        public void setDocUrl(String docUrl) { this.docUrl = docUrl; }
        public boolean isCanRetry() { return canRetry; }
        public void setCanRetry(boolean canRetry) { this.canRetry = canRetry; }
        public Instant getLastChecked() { return lastChecked; }
        public void setLastChecked(Instant lastChecked) { this.lastChecked = lastChecked; }
        public Instant getCooldownUntil() { return cooldownUntil; }
        public void setCooldownUntil(Instant cooldownUntil) { this.cooldownUntil = cooldownUntil; }
    }

    private final Map<String, ProviderHealthStatus> statusCache = new ConcurrentHashMap<>();

    private String buildKey(String providerId, String modelId) {
        String p = providerId != null ? providerId.trim().toLowerCase() : "unknown";
        String m = modelId != null ? modelId.trim().toLowerCase() : "default";
        return p + ":" + m + ":TEXT_TO_IMAGE";
    }

    public ProviderHealthStatus getStatus(String providerId, String modelId) {
        String key = buildKey(providerId, modelId);
        ProviderHealthStatus cached = statusCache.get(key);
        if (cached != null) {
            // Check if cooldown expired
            if (cached.getCooldownUntil() != null && Instant.now().isAfter(cached.getCooldownUntil())) {
                log.info("[ImageProviderStatusCache] Cooldown expired for provider '{}' model '{}'", providerId, modelId);
                cached.setCooldownUntil(null);
                cached.setCanRetry(true);
            }
            return cached;
        }
        return null;
    }

    public boolean isBlocked(String providerId, String modelId) {
        ProviderHealthStatus status = getStatus(providerId, modelId);
        return status != null && status.isBlocked();
    }

    public void recordSuccess(String providerId, String modelId) {
        String key = buildKey(providerId, modelId);
        ProviderHealthStatus health = new ProviderHealthStatus(providerId, modelId, "AVAILABLE");
        health.setLastChecked(Instant.now());
        health.setCooldownUntil(null);
        health.setCanRetry(true);
        statusCache.put(key, health);
        log.info("[ImageProviderStatusCache] Provider '{}' model '{}' marked AVAILABLE.", providerId, modelId);
    }

    public ProviderHealthStatus recordFailure(
            String providerId,
            String modelId,
            ImageErrorCategory category,
            String errorMessage,
            String errorReason,
            String errorNextStep,
            String docUrl
    ) {
        String key = buildKey(providerId, modelId);
        ProviderHealthStatus health = new ProviderHealthStatus(providerId, modelId, category != null ? category.name() : "UNAVAILABLE");
        health.setErrorCategory(category);
        health.setErrorMessage(errorMessage);
        health.setErrorReason(errorReason);
        health.setErrorNextStep(errorNextStep);
        health.setDocUrl(docUrl);
        health.setLastChecked(Instant.now());

        // Compute bounded cooldown based on root-cause category
        int cooldownSeconds = 30; // default for transient failures
        boolean canRetry = false;

        if (category == ImageErrorCategory.ZERO_QUOTA || category == ImageErrorCategory.BILLING_REQUIRED) {
            // Bounded 10-minute cooldown for hard zero-quota / billing setup requirements
            cooldownSeconds = 600;
            canRetry = false;
        } else if (category == ImageErrorCategory.AUTHENTICATION_FAILED) {
            // 15-minute cooldown until credentials updated
            cooldownSeconds = 900;
            canRetry = false;
        } else if (category == ImageErrorCategory.RATE_LIMITED) {
            // 60-second cooldown for rate limit resets
            cooldownSeconds = 60;
            canRetry = true;
        } else if (category == ImageErrorCategory.MODEL_UNAVAILABLE) {
            cooldownSeconds = 1800; // 30 minutes
            canRetry = false;
        } else if (category == ImageErrorCategory.PROVIDER_UNAVAILABLE || category == ImageErrorCategory.NETWORK_TIMEOUT) {
            cooldownSeconds = 20; // 20s transient backoff
            canRetry = true;
        }

        health.setCanRetry(canRetry);
        health.setCooldownUntil(Instant.now().plusSeconds(cooldownSeconds));
        statusCache.put(key, health);

        log.warn("[ImageProviderStatusCache] Cached failure for provider '{}' model '{}' [{}]: cooldown={}s, blocked={}",
                providerId, modelId, category, cooldownSeconds, health.isBlocked());

        return health;
    }

    public void invalidate(String providerId, String modelId) {
        String key = buildKey(providerId, modelId);
        statusCache.remove(key);
        // Also remove wildcard provider entry
        statusCache.remove(providerId.toLowerCase() + ":default:TEXT_TO_IMAGE");
        log.info("[ImageProviderStatusCache] Cache invalidated for provider '{}' model '{}'", providerId, modelId);
    }

    public void invalidateAll() {
        statusCache.clear();
        log.info("[ImageProviderStatusCache] Complete image provider status cache invalidated.");
    }

    public Map<String, Object> getAllStatuses() {
        Map<String, Object> all = new LinkedHashMap<>();
        for (Map.Entry<String, ProviderHealthStatus> entry : statusCache.entrySet()) {
            all.put(entry.getKey(), entry.getValue().toMap());
        }
        return all;
    }
}
