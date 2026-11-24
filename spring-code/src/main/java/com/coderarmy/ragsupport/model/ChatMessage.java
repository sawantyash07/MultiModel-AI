package com.coderarmy.ragsupport.model;

import java.time.LocalDateTime;

public class ChatMessage {

    private String id;
    private String role; // "user" or "assistant" or "system"
    private String content;
    private String imageUrl; // Base64 or URL preview
    private String imageName;
    private String imageMimeType;
    
    // Additional attachment metadata (PDF documents or other files)
    private String fileUrl;
    private String fileName;
    private String fileType;
    private String fileSize;
    private String extractedText;

    // Response timings in milliseconds
    private Long durationMs;
    private Long firstTokenMs;

    private LocalDateTime timestamp;
    private boolean isError;

    public ChatMessage() {
        this.timestamp = LocalDateTime.now();
    }

    public ChatMessage(String id, String role, String content, String imageUrl, String imageName, String imageMimeType) {
        this.id = id;
        this.role = role;
        this.content = content;
        this.imageUrl = imageUrl;
        this.imageName = imageName;
        this.imageMimeType = imageMimeType;
        this.timestamp = LocalDateTime.now();
        this.isError = false;
    }

    public static ChatMessage userMessage(String id, String content) {
        return new ChatMessage(id, "user", content, null, null, null);
    }

    public static ChatMessage userMessage(String id, String content, String imageUrl, String imageName, String imageMimeType) {
        return new ChatMessage(id, "user", content, imageUrl, imageName, imageMimeType);
    }

    public static ChatMessage userMessageWithFile(String id, String content, String imageUrl, String imageName, String imageMimeType,
                                                  String fileUrl, String fileName, String fileType, String fileSize, String extractedText) {
        ChatMessage msg = new ChatMessage(id, "user", content, imageUrl, imageName, imageMimeType);
        msg.setFileUrl(fileUrl);
        msg.setFileName(fileName);
        msg.setFileType(fileType);
        msg.setFileSize(fileSize);
        msg.setExtractedText(extractedText);
        return msg;
    }

    public static ChatMessage assistantMessage(String id, String content) {
        return new ChatMessage(id, "assistant", content, null, null, null);
    }

    public static ChatMessage assistantMessageWithTimings(String id, String content, Long durationMs, Long firstTokenMs) {
        ChatMessage msg = new ChatMessage(id, "assistant", content, null, null, null);
        msg.setDurationMs(durationMs);
        msg.setFirstTokenMs(firstTokenMs);
        return msg;
    }

    public static ChatMessage errorMessage(String id, String content) {
        ChatMessage msg = new ChatMessage(id, "assistant", content, null, null, null);
        msg.setError(true);
        return msg;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
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

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getFileType() {
        return fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public String getFileSize() {
        return fileSize;
    }

    public void setFileSize(String fileSize) {
        this.fileSize = fileSize;
    }

    public String getExtractedText() {
        return extractedText;
    }

    public void setExtractedText(String extractedText) {
        this.extractedText = extractedText;
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Long durationMs) {
        this.durationMs = durationMs;
    }

    public Long getFirstTokenMs() {
        return firstTokenMs;
    }

    public void setFirstTokenMs(Long firstTokenMs) {
        this.firstTokenMs = firstTokenMs;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public boolean isError() {
        return isError;
    }

    public void setError(boolean error) {
        isError = error;
    }
}
