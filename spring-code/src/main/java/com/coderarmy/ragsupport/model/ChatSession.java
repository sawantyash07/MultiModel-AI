package com.coderarmy.ragsupport.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class ChatSession {

    private String sessionId;
    private String title;
    private List<ChatMessage> messages;
    private LocalDateTime createdAt;
    private LocalDateTime lastUpdatedAt;

    public ChatSession() {
        this.messages = new ArrayList<>();
        this.createdAt = LocalDateTime.now();
        this.lastUpdatedAt = LocalDateTime.now();
    }

    public ChatSession(String sessionId, String title) {
        this.sessionId = sessionId;
        this.title = title;
        this.messages = new ArrayList<>();
        this.createdAt = LocalDateTime.now();
        this.lastUpdatedAt = LocalDateTime.now();
    }

    public void addMessage(ChatMessage message) {
        if (this.messages == null) {
            this.messages = new ArrayList<>();
        }
        this.messages.add(message);
        this.lastUpdatedAt = LocalDateTime.now();
        
        if (("New Conversation".equalsIgnoreCase(this.title) || "New chat".equalsIgnoreCase(this.title) 
                || "ChatGPT Multimodal".equalsIgnoreCase(this.title) || "Customer Support Assistant".equalsIgnoreCase(this.title)
                || "Multimodal Assistant".equalsIgnoreCase(this.title) || "Multimodal AI Assistant".equalsIgnoreCase(this.title)
                || this.title == null || this.title.isBlank()) 
                && "user".equals(message.getRole())) {
            this.title = generateSmartTitle(message);
        }
    }

    private String generateSmartTitle(ChatMessage message) {
        if (message.getImageName() != null && !message.getImageName().isBlank()) {
            return "Image: " + message.getImageName();
        }
        if (message.getFileName() != null && !message.getFileName().isBlank()) {
            return "Document: " + message.getFileName();
        }
        String content = message.getContent();
        if (content == null || content.isBlank()) {
            return "Conversation";
        }
        String lower = content.toLowerCase();
        if (lower.contains("name is yash") || lower.contains("yash")) {
            return "Greeting & Intro (Yash)";
        }
        if (lower.contains("tell me about yourself") || lower.contains("who are you") || lower.contains("what can you do")) {
            return "AI Assistant Capabilities";
        }
        if (lower.contains("tell me about myself")) {
            return "Profile & Memory Inquiry";
        }
        if (lower.contains("return") || lower.contains("exchange")) {
            return "Return & Exchange Policy";
        }
        if (lower.contains("refund") || lower.contains("payment") || lower.contains("money back")) {
            return "Payment & Refund Policy";
        }
        if (lower.contains("shipping") || lower.contains("deliver") || lower.contains("track")) {
            return "Shipping & Delivery Info";
        }
        if (lower.contains("order") || lower.contains("cancel")) {
            return "Order Help & Management";
        }
        if (lower.contains("java") || lower.contains("code") || lower.contains("spring") || lower.contains("api")) {
            return "Java & Technical Discussion";
        }
        String clean = content.replaceAll("^(hello|hi|hey|greetings|please|can you|could you)\\s*", "").trim();
        if (clean.length() > 32) {
            clean = clean.substring(0, 32).trim() + "...";
        }
        if (!clean.isBlank()) {
            return Character.toUpperCase(clean.charAt(0)) + clean.substring(1);
        }
        return "Conversation";
    }

    // Getters and Setters
    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<ChatMessage> getMessages() {
        return messages;
    }

    public void setMessages(List<ChatMessage> messages) {
        this.messages = messages;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getLastUpdatedAt() {
        return lastUpdatedAt;
    }

    public void setLastUpdatedAt(LocalDateTime lastUpdatedAt) {
        this.lastUpdatedAt = lastUpdatedAt;
    }
}
