package com.coderarmy.ragsupport.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PastConversationExcerpt {

    private String conversationId;
    private String conversationTitle;
    private String messageId;
    private String timestamp;
    private String userQuery;
    private String assistantExcerpt;
    private double relevanceScore;
    private boolean hasCode;
    private boolean hasError;

    public PastConversationExcerpt() {}

    public PastConversationExcerpt(String conversationId, String conversationTitle, String messageId,
                                  String timestamp, String userQuery, String assistantExcerpt,
                                  double relevanceScore, boolean hasCode, boolean hasError) {
        this.conversationId = conversationId;
        this.conversationTitle = conversationTitle;
        this.messageId = messageId;
        this.timestamp = timestamp;
        this.userQuery = userQuery;
        this.assistantExcerpt = assistantExcerpt;
        this.relevanceScore = relevanceScore;
        this.hasCode = hasCode;
        this.hasError = hasError;
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

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getUserQuery() {
        return userQuery;
    }

    public void setUserQuery(String userQuery) {
        this.userQuery = userQuery;
    }

    public String getAssistantExcerpt() {
        return assistantExcerpt;
    }

    public void setAssistantExcerpt(String assistantExcerpt) {
        this.assistantExcerpt = assistantExcerpt;
    }

    public double getRelevanceScore() {
        return relevanceScore;
    }

    public void setRelevanceScore(double relevanceScore) {
        this.relevanceScore = relevanceScore;
    }

    public boolean isHasCode() {
        return hasCode;
    }

    public void setHasCode(boolean hasCode) {
        this.hasCode = hasCode;
    }

    public boolean isHasError() {
        return hasError;
    }

    public void setHasError(boolean hasError) {
        this.hasError = hasError;
    }
}
