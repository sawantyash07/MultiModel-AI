package com.coderarmy.ragsupport.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DocumentChunk {

    private String id;
    private String documentName;
    private String documentType;
    private int pageNumber; // 1-based page number for PDF/DOCX, or row/sheet index
    private String sectionTitle;
    private String content;
    private boolean isTable;
    private double relevanceScore;

    public DocumentChunk() {}

    public DocumentChunk(String id, String documentName, String documentType, int pageNumber, String sectionTitle, String content, boolean isTable) {
        this.id = id;
        this.documentName = documentName;
        this.documentType = documentType;
        this.pageNumber = pageNumber;
        this.sectionTitle = sectionTitle;
        this.content = content;
        this.isTable = isTable;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getDocumentName() {
        return documentName;
    }

    public void setDocumentName(String documentName) {
        this.documentName = documentName;
    }

    public String getDocumentType() {
        return documentType;
    }

    public void setDocumentType(String documentType) {
        this.documentType = documentType;
    }

    public int getPageNumber() {
        return pageNumber;
    }

    public void setPageNumber(int pageNumber) {
        this.pageNumber = pageNumber;
    }

    public String getSectionTitle() {
        return sectionTitle;
    }

    public void setSectionTitle(String sectionTitle) {
        this.sectionTitle = sectionTitle;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public boolean isTable() {
        return isTable;
    }

    public void setTable(boolean table) {
        isTable = table;
    }

    public double getRelevanceScore() {
        return relevanceScore;
    }

    public void setRelevanceScore(double relevanceScore) {
        this.relevanceScore = relevanceScore;
    }
}
