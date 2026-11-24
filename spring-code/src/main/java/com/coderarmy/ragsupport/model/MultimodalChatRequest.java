package com.coderarmy.ragsupport.model;

public class MultimodalChatRequest {

    private String sessionId;
    private String prompt;
    private String imageBase64;
    private String imageName;
    private String imageMimeType;

    public MultimodalChatRequest() {
    }

    public MultimodalChatRequest(String sessionId, String prompt, String imageBase64, String imageName, String imageMimeType) {
        this.sessionId = sessionId;
        this.prompt = prompt;
        this.imageBase64 = imageBase64;
        this.imageName = imageName;
        this.imageMimeType = imageMimeType;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getImageBase64() {
        return imageBase64;
    }

    public void setImageBase64(String imageBase64) {
        this.imageBase64 = imageBase64;
    }

    public String getImageName() {
        return imageName;
    }

    public void setImageName(String imageName) {
        this.imageName = imageName;
    }

    public String getImageMimeType() {
        return imageMimeType;
    }

    public void setImageMimeType(String imageMimeType) {
        this.imageMimeType = imageMimeType;
    }
}
