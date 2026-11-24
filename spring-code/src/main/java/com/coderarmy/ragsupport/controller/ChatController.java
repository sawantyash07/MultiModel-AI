package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.DocumentExtractionResult;
import com.coderarmy.ragsupport.service.ConversationStorageService;
import com.coderarmy.ragsupport.service.DocumentIntelligenceService;
import com.coderarmy.ragsupport.service.HfInferenceService;
import com.coderarmy.ragsupport.service.SuggestionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.util.*;

@RestController
@CrossOrigin(origins = "*")
public class ChatController {

    private static final long MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp"
    );

    private final HfInferenceService inferenceService;
    private final SuggestionService suggestionService;
    private final com.coderarmy.ragsupport.service.StreamCancellationRegistry cancellationRegistry;

    @org.springframework.beans.factory.annotation.Autowired
    public ChatController(
            HfInferenceService inferenceService,
            SuggestionService suggestionService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) com.coderarmy.ragsupport.service.StreamCancellationRegistry cancellationRegistry
    ) {
        this.inferenceService = inferenceService;
        this.suggestionService = suggestionService;
        this.cancellationRegistry = cancellationRegistry != null ? cancellationRegistry : new com.coderarmy.ragsupport.service.StreamCancellationRegistry();
    }

    public ChatController(HfInferenceService inferenceService) {
        this(inferenceService, new SuggestionService(new ConversationStorageService()), new com.coderarmy.ragsupport.service.StreamCancellationRegistry());
    }

    /**
     * POST /api/chat/upload
     * Dedicated image upload endpoint (JPEG, PNG, WebP) with 20MB limit.
     */
    @PostMapping(value = {"/api/chat/upload", "/api/ai/chat/upload"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadAttachment(
            @RequestParam("file") MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("status", "error", "error", "No file uploaded. Please select an image to upload."));
        }

        if (file.getSize() > MAX_IMAGE_SIZE_BYTES) {
            long sizeMb = file.getSize() / (1024 * 1024);
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(Map.of("status", "error", "error", "Image size (" + sizeMb + "MB) exceeds the maximum allowed limit of 20MB."));
        }

        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body(Map.of("status", "error", "error", "Unsupported image format: '" + contentType + "'. Supported formats are JPEG, PNG, and WebP."));
        }

        try {
            byte[] bytes = file.getBytes();
            String base64 = Base64.getEncoder().encodeToString(bytes);
            String dataUrl = "data:" + contentType + ";base64," + base64;
            String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "image.png";
            String formattedSize = formatFileSize(file.getSize());

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "ready");
            response.put("name", fileName);
            response.put("type", contentType);
            response.put("size", file.getSize());
            response.put("formattedSize", formattedSize);
            response.put("dataUrl", dataUrl);
            response.put("message", "Image uploaded successfully and ready for analysis");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "error", "Failed to process image: " + e.getMessage()));
        }
    }

    /**
     * POST /api/chat, /api/chat/stream, /api/ai/chat, /api/ai/chat/stream (JSON Payload)
     * Real-time Server-Sent Events (SSE) streaming chat endpoint.
     */
    @PostMapping(
            value = {"/api/chat", "/api/chat/stream", "/api/ai/chat", "/api/ai/chat/stream"},
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public Flux<ServerSentEvent<String>> streamChat(@RequestBody Map<String, Object> body) {
        String conversationId = (String) body.get("conversationId");
        String modelId = (String) body.get("modelId");
        if (modelId == null || modelId.isBlank()) {
            modelId = (String) body.getOrDefault("model", "auto");
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> messages = (List<Map<String, Object>>) body.get("messages");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> attachments = (List<Map<String, Object>>) body.get("attachments");
        String systemInstruction = (String) body.get("systemInstruction");
        String language = (String) body.getOrDefault("language", "en");
        Boolean webSearch = body.containsKey("webSearch") ? (Boolean) body.get("webSearch") : null;
        Boolean allowFallback = body.containsKey("allowFallback") ? Boolean.TRUE.equals(body.get("allowFallback")) : false;
        String requestId = (String) body.get("requestId");
        String messageId = (String) body.get("messageId");

        return inferenceService.streamInference(
                conversationId,
                modelId,
                messages,
                attachments,
                systemInstruction,
                language,
                webSearch,
                allowFallback,
                requestId,
                messageId
        );
    }

    /**
     * POST /api/chat/stop, /api/ai/chat/stop, /api/chat/cancel
     * Immediately aborts and cancels an active in-flight LLM inference request across providers.
     */
    @PostMapping(value = {"/api/chat/stop", "/api/ai/chat/stop", "/api/chat/cancel"})
    public ResponseEntity<Map<String, Object>> stopStream(@RequestBody(required = false) Map<String, Object> body) {
        String requestId = (body != null) ? (String) body.get("requestId") : null;
        String conversationId = (body != null) ? (String) body.get("conversationId") : null;
        String messageId = (body != null) ? (String) body.get("messageId") : null;

        boolean cancelled = false;
        if (requestId != null && !requestId.isBlank()) {
            cancelled = cancellationRegistry.cancel(requestId);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", cancelled ? "cancelled" : "stopped");
        response.put("requestId", requestId != null ? requestId : "");
        response.put("conversationId", conversationId != null ? conversationId : "");
        response.put("messageId", messageId != null ? messageId : "");
        response.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/chat, /api/chat/stream, /api/ai/chat, /api/ai/chat/stream (Multipart Form Payload)
     * Supports direct multipart upload streaming with prompt and attached file(s).
     */
    @PostMapping(
            value = {"/api/chat", "/api/chat/stream", "/api/ai/chat", "/api/ai/chat/stream"},
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public Flux<ServerSentEvent<String>> streamChatMultipart(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "prompt", required = false, defaultValue = "") String prompt,
            @RequestParam(value = "modelId", required = false, defaultValue = "auto") String modelId,
            @RequestParam(value = "language", required = false, defaultValue = "en") String language,
            @RequestParam(value = "conversationId", required = false) String conversationId,
            @RequestParam(value = "systemInstruction", required = false) String systemInstruction,
            @RequestParam(value = "webSearch", required = false) Boolean webSearch
    ) {
        List<Map<String, Object>> attachments = new ArrayList<>();
        List<MultipartFile> targetFiles = new ArrayList<>();
        if (file != null && !file.isEmpty()) targetFiles.add(file);
        if (files != null) targetFiles.addAll(files);

        for (MultipartFile f : targetFiles) {
            if (f != null && !f.isEmpty()) {
                String cType = f.getContentType() != null ? f.getContentType() : "application/octet-stream";
                try {
                    String b64 = Base64.getEncoder().encodeToString(f.getBytes());
                    attachments.add(Map.of(
                            "name", f.getOriginalFilename() != null ? f.getOriginalFilename() : "file",
                            "type", cType,
                            "size", f.getSize(),
                            "formattedSize", formatFileSize(f.getSize()),
                            "dataUrl", "data:" + cType + ";base64," + b64
                    ));
                } catch (IOException ignored) {}
            }
        }

        String userPrompt = (prompt != null && !prompt.isBlank())
                ? prompt.trim()
                : (attachments.isEmpty() ? "Hello" : "Analyze this attachment and answer my questions.");

        List<Map<String, Object>> messages = List.of(
                Map.of("role", "user", "content", userPrompt, "attachments", attachments)
        );

        return inferenceService.streamInference(
                conversationId,
                modelId,
                messages,
                attachments,
                systemInstruction,
                language,
                webSearch
        );
    }

    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
    }

    /**
     * GET /api/chat/personalized-suggestions, /api/ai/chat/personalized-suggestions
     * Generates personalized starter prompt cards and chips dynamically based on user history and interests.
     */
    @GetMapping(value = {"/api/chat/personalized-suggestions", "/api/ai/chat/personalized-suggestions"})
    public ResponseEntity<Map<String, Object>> getPersonalizedSuggestions() {
        Map<String, Object> dash = suggestionService.generatePersonalizedDashboardSuggestions();
        // Keep backward-compatible "suggestions" key alongside "cards" and "chips"
        dash.put("suggestions", suggestionService.generatePersonalizedSuggestions());
        return ResponseEntity.ok(dash);
    }

    /**
     * POST /api/chat/suggestions, /api/ai/chat/suggestions
     * Generates 3-5 dynamic, context-aware follow-up question objects based on prompt, AI answer, history, and attachments.
     */
    @PostMapping(value = {"/api/chat/suggestions", "/api/ai/chat/suggestions"})
    public ResponseEntity<Map<String, Object>> getSuggestions(@RequestBody Map<String, Object> body) {
        String prompt = (String) body.getOrDefault("prompt", "");
        String answer = (String) body.getOrDefault("answer", "");
        String modelId = (String) body.getOrDefault("modelId", "auto");
        String language = (String) body.getOrDefault("language", "en");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> history = (List<Map<String, Object>>) body.get("history");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> attachments = (List<Map<String, Object>>) body.get("attachments");

        List<Map<String, Object>> structuredSuggestions = suggestionService.generateStructuredFollowUpSuggestions(
                prompt, answer, history, modelId, language, attachments
        );
        String topic = suggestionService.detectTopicName(prompt, answer, history, attachments);
        boolean hasAiGenerated = structuredSuggestions.stream()
                .anyMatch(s -> Boolean.TRUE.equals(s.get("isAiGenerated")));

        return ResponseEntity.ok(Map.of(
                "suggestions", structuredSuggestions,
                "topic", topic,
                "isAiGenerated", hasAiGenerated
        ));
    }
}
