package com.coderarmy.ragsupport.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Represents a persistent user memory item across conversation sessions.
 * Supports semantic embeddings, categories, tracking status (ACTIVE, RESOLVED, COMPLETED, SUPERSEDED),
 * and links to conversation context.
 * Never stores secrets, credentials, or authentication tokens.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserMemory {

    private String id;
    private String content;
    private String category; // PREFERENCE, TECH_STACK, PROJECT, DECISION, ERROR_SOLUTION, UNRESOLVED_TASK, CODE_CHANGE, REQUIREMENT, GENERAL
    private String source;   // e.g. "chat_extraction", "manual_entry", "project_tracker"
    private String conversationId;
    private String conversationTitle;
    private String status;   // ACTIVE, COMPLETED, RESOLVED, SUPERSEDED
    private int importance;  // 1 to 5 (default: 3)
    private double confidence;
    private List<String> tags = new ArrayList<>();
    private List<Float> embedding; // 384-dimensional dense vector
    private String createdAt;
    private String updatedAt;

    public UserMemory() {
        this.id = "mem-" + UUID.randomUUID().toString().substring(0, 8);
        this.createdAt = Instant.now().toString();
        this.updatedAt = this.createdAt;
        this.confidence = 1.0;
        this.importance = 3;
        this.status = "ACTIVE";
        this.category = "GENERAL";
    }

    public UserMemory(String content, String category, String source) {
        this();
        this.content = content;
        this.category = category != null && !category.isBlank() ? category.toUpperCase().trim() : "GENERAL";
        this.source = source != null && !source.isBlank() ? source : "manual_entry";
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }

    public String getConversationTitle() {
        return conversationTitle;
    }

    public void setConversationTitle(String conversationTitle) {
        this.conversationTitle = conversationTitle;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getImportance() {
        return importance;
    }

    public void setImportance(int importance) {
        this.importance = importance;
    }

    public double getConfidence() {
        return confidence;
    }

    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public List<Float> getEmbedding() {
        return embedding;
    }

    public void setEmbedding(List<Float> embedding) {
        this.embedding = embedding;
    }

    public void setEmbeddingFromFloats(float[] floats) {
        if (floats == null) {
            this.embedding = null;
            return;
        }
        List<Float> list = new ArrayList<>(floats.length);
        for (float f : floats) {
            list.add(f);
        }
        this.embedding = list;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
