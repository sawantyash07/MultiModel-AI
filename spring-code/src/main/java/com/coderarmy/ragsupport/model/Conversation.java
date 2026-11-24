package com.coderarmy.ragsupport.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class Conversation {
    private String id;
    private String title;
    private String modelId;
    private String createdAt;
    private String updatedAt;
    private List<Map<String, Object>> messages = new ArrayList<>();
    private List<Map<String, Object>> highlights = new ArrayList<>();
    private String lastMessagePreview;

    public Conversation() {}

    public Conversation(String id, String title, String modelId, String createdAt, String updatedAt) {
        this.id = id;
        this.title = title;
        this.modelId = modelId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getModelId() { return modelId; }
    public void setModelId(String modelId) { this.modelId = modelId; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }

    public List<Map<String, Object>> getMessages() { return messages; }
    public void setMessages(List<Map<String, Object>> messages) { this.messages = messages; }

    public List<Map<String, Object>> getHighlights() { return highlights != null ? highlights : new ArrayList<>(); }
    public void setHighlights(List<Map<String, Object>> highlights) { this.highlights = highlights != null ? highlights : new ArrayList<>(); }

    public String getLastMessagePreview() { return lastMessagePreview; }
    public void setLastMessagePreview(String lastMessagePreview) { this.lastMessagePreview = lastMessagePreview; }
}
