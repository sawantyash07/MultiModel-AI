package com.coderarmy.ragsupport.hub.model;

import java.util.Map;

public class ImageGenerationResponse {
    private String id;
    private String modelId;
    private String modelName;
    private String provider;
    private String prompt;
    private String originalPrompt;
    private String enhancedPrompt;
    private String negativePrompt;
    private String imageDataUrl;
    private int width;
    private int height;
    private String aspectRatio;
    private String createdAt;
    private long durationMs;
    private String status; // "SUCCESS" or "ERROR"
    private String error;
    private String fallbackFrom;
    private String fallbackReason;
    private Long seed;
    private Map<String, Object> structuredSpec;
    private boolean hasReferenceImage;
    private boolean canFallback;
    private String fallbackModelId;
    private String fallbackModelName;
    private String fallbackProvider;
    private String actualModelId;
    private String actualModelName;
    private String actualProvider;
    private String errorCategory;
    private String errorReason;
    private String errorNextStep;
    private String docUrl;
    private boolean canRetry;
    private int cooldownSeconds;

    public ImageGenerationResponse() {}

    public ImageGenerationResponse(
            String id,
            String modelId,
            String modelName,
            String provider,
            String prompt,
            String negativePrompt,
            String imageDataUrl,
            int width,
            int height,
            String aspectRatio,
            String createdAt,
            long durationMs,
            String status,
            String error
    ) {
        this.id = id;
        this.modelId = modelId;
        this.modelName = modelName;
        this.provider = provider;
        this.prompt = prompt;
        this.originalPrompt = prompt;
        this.negativePrompt = negativePrompt;
        this.imageDataUrl = imageDataUrl;
        this.width = width;
        this.height = height;
        this.aspectRatio = aspectRatio;
        this.createdAt = createdAt;
        this.durationMs = durationMs;
        this.status = status;
        this.error = error;
    }

    public static ImageGenerationResponse success(
            String id,
            String modelId,
            String modelName,
            String provider,
            String prompt,
            String negativePrompt,
            String imageDataUrl,
            int width,
            int height,
            String aspectRatio,
            String createdAt,
            long durationMs
    ) {
        return new ImageGenerationResponse(
                id, modelId, modelName, provider, prompt, negativePrompt,
                imageDataUrl, width, height, aspectRatio, createdAt, durationMs, "SUCCESS", null
        );
    }

    public static ImageGenerationResponse error(
            String error,
            String modelId,
            String modelName,
            String provider,
            String prompt,
            long durationMs
    ) {
        ImageGenerationResponse resp = new ImageGenerationResponse(
                null, modelId, modelName, provider, prompt, null,
                null, 0, 0, null, null, durationMs, "ERROR", error
        );
        resp.setOriginalPrompt(prompt);
        return resp;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getModelId() {
        return modelId;
    }

    public void setModelId(String modelId) {
        this.modelId = modelId;
    }

    public String getModelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getOriginalPrompt() {
        return originalPrompt != null ? originalPrompt : prompt;
    }

    public void setOriginalPrompt(String originalPrompt) {
        this.originalPrompt = originalPrompt;
    }

    public String getEnhancedPrompt() {
        return enhancedPrompt;
    }

    public void setEnhancedPrompt(String enhancedPrompt) {
        this.enhancedPrompt = enhancedPrompt;
    }

    public String getNegativePrompt() {
        return negativePrompt;
    }

    public void setNegativePrompt(String negativePrompt) {
        this.negativePrompt = negativePrompt;
    }

    public String getImageDataUrl() {
        return imageDataUrl;
    }

    public void setImageDataUrl(String imageDataUrl) {
        this.imageDataUrl = imageDataUrl;
    }

    public int getWidth() {
        return width;
    }

    public void setWidth(int width) {
        this.width = width;
    }

    public int getHeight() {
        return height;
    }

    public void setHeight(int height) {
        this.height = height;
    }

    public String getAspectRatio() {
        return aspectRatio;
    }

    public void setAspectRatio(String aspectRatio) {
        this.aspectRatio = aspectRatio;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(long durationMs) {
        this.durationMs = durationMs;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public String getFallbackFrom() {
        return fallbackFrom;
    }

    public void setFallbackFrom(String fallbackFrom) {
        this.fallbackFrom = fallbackFrom;
    }

    public String getFallbackReason() {
        return fallbackReason;
    }

    public void setFallbackReason(String fallbackReason) {
        this.fallbackReason = fallbackReason;
    }

    public Long getSeed() {
        return seed;
    }

    public void setSeed(Long seed) {
        this.seed = seed;
    }

    public Map<String, Object> getStructuredSpec() {
        return structuredSpec;
    }

    public void setStructuredSpec(Map<String, Object> structuredSpec) {
        this.structuredSpec = structuredSpec;
    }

    public boolean isHasReferenceImage() {
        return hasReferenceImage;
    }

    public void setHasReferenceImage(boolean hasReferenceImage) {
        this.hasReferenceImage = hasReferenceImage;
    }

    public boolean isCanFallback() {
        return canFallback;
    }

    public void setCanFallback(boolean canFallback) {
        this.canFallback = canFallback;
    }

    public String getFallbackModelId() {
        return fallbackModelId;
    }

    public void setFallbackModelId(String fallbackModelId) {
        this.fallbackModelId = fallbackModelId;
    }

    public String getFallbackModelName() {
        return fallbackModelName;
    }

    public void setFallbackModelName(String fallbackModelName) {
        this.fallbackModelName = fallbackModelName;
    }

    public String getFallbackProvider() {
        return fallbackProvider;
    }

    public void setFallbackProvider(String fallbackProvider) {
        this.fallbackProvider = fallbackProvider;
    }

    public String getActualModelId() {
        return actualModelId;
    }

    public void setActualModelId(String actualModelId) {
        this.actualModelId = actualModelId;
    }

    public String getActualModelName() {
        return actualModelName != null ? actualModelName : (modelName != null ? modelName : modelId);
    }

    public void setActualModelName(String actualModelName) {
        this.actualModelName = actualModelName;
    }

    public String getActualProvider() {
        return actualProvider != null ? actualProvider : (provider != null ? provider : "Unknown");
    }

    public void setActualProvider(String actualProvider) {
        this.actualProvider = actualProvider;
    }

    public String getErrorCategory() {
        return errorCategory;
    }

    public void setErrorCategory(String errorCategory) {
        this.errorCategory = errorCategory;
    }

    public String getErrorReason() {
        return errorReason;
    }

    public void setErrorReason(String errorReason) {
        this.errorReason = errorReason;
    }

    public String getErrorNextStep() {
        return errorNextStep;
    }

    public void setErrorNextStep(String errorNextStep) {
        this.errorNextStep = errorNextStep;
    }

    public String getDocUrl() {
        return docUrl;
    }

    public void setDocUrl(String docUrl) {
        this.docUrl = docUrl;
    }

    public boolean isCanRetry() {
        return canRetry;
    }

    public void setCanRetry(boolean canRetry) {
        this.canRetry = canRetry;
    }

    public int getCooldownSeconds() {
        return cooldownSeconds;
    }

    public void setCooldownSeconds(int cooldownSeconds) {
        this.cooldownSeconds = cooldownSeconds;
    }
}
