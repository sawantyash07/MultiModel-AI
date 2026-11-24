package com.coderarmy.ragsupport.model;

public class MultimodalChatResponse {

    private String sessionId;
    private String answer;
    private ChatMessage userMessage;
    private ChatMessage assistantMessage;
    private int totalMessagesInSession;
    private boolean isFallbackResponse;

    public MultimodalChatResponse() {
    }

    public MultimodalChatResponse(String sessionId, String answer, ChatMessage userMessage, ChatMessage assistantMessage, int totalMessagesInSession, boolean isFallbackResponse) {
        this.sessionId = sessionId;
        this.answer = answer;
        this.userMessage = userMessage;
        this.assistantMessage = assistantMessage;
        this.totalMessagesInSession = totalMessagesInSession;
        this.isFallbackResponse = isFallbackResponse;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public ChatMessage getUserMessage() {
        return userMessage;
    }

    public void setUserMessage(ChatMessage userMessage) {
        this.userMessage = userMessage;
    }

    public ChatMessage getAssistantMessage() {
        return assistantMessage;
    }

    public void setAssistantMessage(ChatMessage assistantMessage) {
        this.assistantMessage = assistantMessage;
    }

    public int getTotalMessagesInSession() {
        return totalMessagesInSession;
    }

    public void setTotalMessagesInSession(int totalMessagesInSession) {
        this.totalMessagesInSession = totalMessagesInSession;
    }

    public boolean isFallbackResponse() {
        return isFallbackResponse;
    }

    public void setFallbackResponse(boolean fallbackResponse) {
        isFallbackResponse = fallbackResponse;
    }
}
