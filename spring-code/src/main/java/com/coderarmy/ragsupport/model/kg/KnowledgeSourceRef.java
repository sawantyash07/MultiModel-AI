package com.coderarmy.ragsupport.model.kg;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Objects;

/**
 * Traceable origin reference for a knowledge graph entity or relationship.
 * Enables strict provenance tracing to source conversations, messages, memories, or documents.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KnowledgeSourceRef {

    private String sourceType;    // "conversation", "document", "memory", "project", "manual"
    private String sourceId;      // conversationId, documentId, or memoryId
    private String sourceTitle;   // Conversation title, document file name, etc.
    private String messageId;     // Specific message ID within conversation
    private Integer pageNumber;   // Page number or sheet in document (if applicable)
    private String excerpt;       // Verbatim text quote or evidence excerpt
    private String timestamp;     // Occurrence timestamp

    public KnowledgeSourceRef() {
        this.timestamp = Instant.now().toString();
    }

    public KnowledgeSourceRef(String sourceType, String sourceId, String sourceTitle, String excerpt) {
        this();
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.sourceTitle = sourceTitle;
        this.excerpt = excerpt;
    }

    public KnowledgeSourceRef(String sourceType, String sourceId, String sourceTitle, String messageId, String excerpt) {
        this(sourceType, sourceId, sourceTitle, excerpt);
        this.messageId = messageId;
    }

    public KnowledgeSourceRef(String sourceType, String sourceId, String sourceTitle, Integer pageNumber, String excerpt) {
        this(sourceType, sourceId, sourceTitle, excerpt);
        this.pageNumber = pageNumber;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public String getSourceId() {
        return sourceId;
    }

    public void setSourceId(String sourceId) {
        this.sourceId = sourceId;
    }

    public String getSourceTitle() {
        return sourceTitle;
    }

    public void setSourceTitle(String sourceTitle) {
        this.sourceTitle = sourceTitle;
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public Integer getPageNumber() {
        return pageNumber;
    }

    public void setPageNumber(Integer pageNumber) {
        this.pageNumber = pageNumber;
    }

    public String getExcerpt() {
        return excerpt;
    }

    public void setExcerpt(String excerpt) {
        this.excerpt = excerpt;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        KnowledgeSourceRef that = (KnowledgeSourceRef) o;
        return Objects.equals(sourceType, that.sourceType) &&
                Objects.equals(sourceId, that.sourceId) &&
                Objects.equals(messageId, that.messageId) &&
                Objects.equals(pageNumber, that.pageNumber) &&
                Objects.equals(excerpt, that.excerpt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sourceType, sourceId, messageId, pageNumber, excerpt);
    }
}
