package com.coderarmy.ragsupport.hub.model;

import java.util.List;
import java.util.Map;

public class TextGenerationRequest {
    private String modelId;
    private String prompt;
    private List<Map<String, String>> messages;
    private Double temperature;
    private Integer maxTokens;
    private String systemInstruction;

    public TextGenerationRequest() {}

    public String getModelId() {
        return modelId;
    }

    public void setModelId(String modelId) {
        this.modelId = modelId;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public List<Map<String, String>> getMessages() {
        return messages;
    }

    public void setMessages(List<Map<String, String>> messages) {
        this.messages = messages;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public Integer getMaxTokens() {
        return maxTokens;
    }

    public void setMaxTokens(Integer maxTokens) {
        this.maxTokens = maxTokens;
    }

    public String getSystemInstruction() {
        return systemInstruction;
    }

    public void setSystemInstruction(String systemInstruction) {
        this.systemInstruction = systemInstruction;
    }
}
