package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.DocumentChunk;
import com.coderarmy.ragsupport.model.DocumentExtractionResult;
import com.coderarmy.ragsupport.service.DocumentIntelligenceService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "*")
public class DocumentController {

    private final DocumentIntelligenceService documentService;
    private final com.coderarmy.ragsupport.service.kg.KnowledgeExtractionPipeline extractionPipeline;

    @org.springframework.beans.factory.annotation.Autowired
    public DocumentController(
            DocumentIntelligenceService documentService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) com.coderarmy.ragsupport.service.kg.KnowledgeExtractionPipeline extractionPipeline
    ) {
        this.documentService = documentService;
        this.extractionPipeline = extractionPipeline;
    }

    /**
     * POST /api/documents/upload
     * Accepts PDF, DOCX, XLSX, XLS, CSV, TXT, MD files.
     * Extracts text/tables, chunks with page metadata, and indexes for conversation RAG.
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "conversationId", required = false) String conversationId
    ) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }

        try {
            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document";
            String contentType = file.getContentType();
            byte[] bytes = file.getBytes();

            DocumentExtractionResult result = documentService.extractAndIndex(
                    conversationId,
                    originalName,
                    contentType,
                    bytes
            );

            if (extractionPipeline != null) {
                extractionPipeline.extractFromDocumentAsync(result);
            }

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("status", "ready");
            resp.put("documentId", result.getDocumentId());
            resp.put("fileName", result.getFileName());
            resp.put("fileType", result.getFileType());
            resp.put("fileSize", result.getFileSize());
            resp.put("formattedSize", result.getFormattedSize());
            resp.put("pageCount", result.getPageCount());
            resp.put("chunkCount", result.getChunkCount());
            resp.put("tableCount", result.getTableCount());
            resp.put("isScanned", result.isScanned());
            resp.put("summaryPreview", result.getSummaryPreview());
            resp.put("message", "Document processed and indexed for question answering");

            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to process document: " + e.getMessage()));
        }
    }

    /**
     * GET /api/documents/{conversationId}
     * Retrieves all indexed documents for a conversation.
     */
    @GetMapping("/{conversationId}")
    public ResponseEntity<Map<String, Object>> getDocuments(@PathVariable("conversationId") String conversationId) {
        List<DocumentExtractionResult> docs = documentService.getDocuments(conversationId);
        return ResponseEntity.ok(Map.of(
                "conversationId", conversationId,
                "count", docs.size(),
                "documents", docs
        ));
    }

    /**
     * DELETE /api/documents/{conversationId}
     * Clears all indexed documents for a conversation.
     */
    @DeleteMapping("/{conversationId}")
    public ResponseEntity<Map<String, Object>> clearDocuments(@PathVariable("conversationId") String conversationId) {
        documentService.clearDocuments(conversationId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "conversationId", conversationId,
                "message", "Documents cleared for conversation"
        ));
    }
}
