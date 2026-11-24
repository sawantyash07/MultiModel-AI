package com.coderarmy.ragsupport.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DocumentExtractionResult {

    private String documentId;
    private String fileName;
    private String fileType;
    private long fileSize;
    private String formattedSize;
    private int pageCount;
    private int chunkCount;
    private int tableCount;
    private boolean isScanned;
    private String summaryPreview;
    private List<DocumentChunk> chunks = new ArrayList<>();
    private List<String> extractedTables = new ArrayList<>();

    public DocumentExtractionResult() {}

    public String getDocumentId() {
        return documentId;
    }

    public void setDocumentId(String documentId) {
        this.documentId = documentId;
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

    public long getFileSize() {
        return fileSize;
    }

    public void setFileSize(long fileSize) {
        this.fileSize = fileSize;
    }

    public String getFormattedSize() {
        return formattedSize;
    }

    public void setFormattedSize(String formattedSize) {
        this.formattedSize = formattedSize;
    }

    public int getPageCount() {
        return pageCount;
    }

    public void setPageCount(int pageCount) {
        this.pageCount = pageCount;
    }

    public int getChunkCount() {
        return chunkCount;
    }

    public void setChunkCount(int chunkCount) {
        this.chunkCount = chunkCount;
    }

    public int getTableCount() {
        return tableCount;
    }

    public void setTableCount(int tableCount) {
        this.tableCount = tableCount;
    }

    public boolean isScanned() {
        return isScanned;
    }

    public void setScanned(boolean scanned) {
        isScanned = scanned;
    }

    public String getSummaryPreview() {
        return summaryPreview;
    }

    public void setSummaryPreview(String summaryPreview) {
        this.summaryPreview = summaryPreview;
    }

    public List<DocumentChunk> getChunks() {
        return chunks;
    }

    public void setChunks(List<DocumentChunk> chunks) {
        this.chunks = chunks;
    }

    public List<String> getExtractedTables() {
        return extractedTables;
    }

    public void setExtractedTables(List<String> extractedTables) {
        this.extractedTables = extractedTables;
    }
}
