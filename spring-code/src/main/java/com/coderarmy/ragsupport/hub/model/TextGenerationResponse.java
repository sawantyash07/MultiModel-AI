package com.coderarmy.ragsupport.hub.model;

public class TextGenerationResponse {
    private String text;
    private String modelId;
    private String modelName;
    private String provider;
    private long durationMs;
    private int tokensUsed;
    private String status; // "SUCCESS" or "ERROR"
    private String error;

    public TextGenerationResponse() {}

    public TextGenerationResponse(String text, String modelId, String modelName, String provider, long durationMs, int tokensUsed, String status, String error) {
        this.text = text;
        this.modelId = modelId;
        this.modelName = modelName;
        this.provider = provider;
        this.durationMs = durationMs;
        this.tokensUsed = tokensUsed;
        this.status = status;
        this.error = error;
    }

    public static TextGenerationResponse success(String text, String modelId, String modelName, String provider, long durationMs, int tokensUsed) {
        return new TextGenerationResponse(text, modelId, modelName, provider, durationMs, tokensUsed, "SUCCESS", null);
    }

    public static TextGenerationResponse error(String error, String modelId, String modelName, String provider, long durationMs) {
        return new TextGenerationResponse("", modelId, modelName, provider, durationMs, 0, "ERROR", error);
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
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

    public int getTokensUsed() {
        return tokensUsed;
    }

    public void setTokensUsed(int tokensUsed) {
        this.tokensUsed = tokensUsed;
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
