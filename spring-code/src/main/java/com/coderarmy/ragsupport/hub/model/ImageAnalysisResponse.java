package com.coderarmy.ragsupport.hub.model;

public class ImageAnalysisResponse {
    private String description;
    private String modelId;
    private String modelName;
    private String provider;
    private long durationMs;
    private String status; // "SUCCESS" or "ERROR"
    private String error;

    public ImageAnalysisResponse() {}

    public ImageAnalysisResponse(String description, String modelId, String modelName, String provider, long durationMs, String status, String error) {
        this.description = description;
        this.modelId = modelId;
        this.modelName = modelName;
        this.provider = provider;
        this.durationMs = durationMs;
        this.status = status;
        this.error = error;
    }

    public static ImageAnalysisResponse success(String description, String modelId, String modelName, String provider, long durationMs) {
        return new ImageAnalysisResponse(description, modelId, modelName, provider, durationMs, "SUCCESS", null);
    }

    public static ImageAnalysisResponse error(String error, String modelId, String modelName, String provider, long durationMs) {
        return new ImageAnalysisResponse("", modelId, modelName, provider, durationMs, "ERROR", error);
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
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
}
