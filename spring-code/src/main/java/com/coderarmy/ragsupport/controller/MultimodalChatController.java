package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.ChatSession;
import com.coderarmy.ragsupport.model.MultimodalChatRequest;
import com.coderarmy.ragsupport.model.MultimodalChatResponse;
import com.coderarmy.ragsupport.model.MultimodalConceptExplanation;
import com.coderarmy.ragsupport.service.ChatSessionService;
import com.coderarmy.ragsupport.service.MultimodalAiService;
import com.coderarmy.ragsupport.service.MultimodalConceptService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = "*")
public class MultimodalChatController {

    private final MultimodalAiService multimodalAiService;
    private final ChatSessionService chatSessionService;
    private final MultimodalConceptService multimodalConceptService;

    @Autowired
    public MultimodalChatController(
            MultimodalAiService multimodalAiService,
            ChatSessionService chatSessionService,
            MultimodalConceptService multimodalConceptService
    ) {
        this.multimodalAiService = multimodalAiService;
        this.chatSessionService = chatSessionService;
        this.multimodalConceptService = multimodalConceptService;
    }

    /**
     * Real-time Server-Sent Events (SSE) streaming endpoint for Multipart Form data (Prompt + File Attachment).
     */
    @PostMapping(value = "/chat/stream", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> streamChatMultipart(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "prompt", required = false, defaultValue = "") String prompt,
            @RequestParam(value = "sessionId", required = false) String sessionId
    ) {
        MultipartFile targetFile = file;
        if (targetFile == null && files != null && !files.isEmpty()) {
            targetFile = files.get(0);
        }
        return multimodalAiService.streamMultimodalQuery(
                sessionId,
                prompt,
                targetFile,
                null,
                null,
                null
        );
    }

    /**
     * Real-time Server-Sent Events (SSE) streaming endpoint for JSON payload (Prompt + Base64 Attachment).
     */
    @PostMapping(value = "/chat/stream", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> streamChatJson(
            @RequestBody MultimodalChatRequest request
    ) {
        return multimodalAiService.streamMultimodalQuery(
                request.getSessionId(),
                request.getPrompt(),
                null,
                request.getImageBase64(),
                request.getImageName(),
                request.getImageMimeType()
        );
    }

    /**
     * Multipart form endpoint accepting text prompt and uploaded image/file.
     */
    @PostMapping(value = "/chat/multimodal", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MultimodalChatResponse> chatMultimodalMultipart(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "prompt", required = false, defaultValue = "") String prompt,
            @RequestParam(value = "sessionId", required = false) String sessionId
    ) {
        MultimodalChatResponse response = multimodalAiService.processMultimodalQuery(
                sessionId,
                prompt,
                file,
                null,
                null,
                null
        );
        return ResponseEntity.ok(response);
    }

    /**
     * JSON endpoint accepting prompt and base64 encoded image or text-only query.
     */
    @PostMapping(value = "/chat", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<MultimodalChatResponse> chatJson(
            @RequestBody MultimodalChatRequest request
    ) {
        MultimodalChatResponse response = multimodalAiService.processMultimodalQuery(
                request.getSessionId(),
                request.getPrompt(),
                null,
                request.getImageBase64(),
                request.getImageName(),
                request.getImageMimeType()
        );
        return ResponseEntity.ok(response);
    }

    /**
     * Generate dynamic, context-aware follow-up question suggestions for the multimodal assistant.
     */
    @PostMapping(value = "/chat/suggestions", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getDynamicSuggestions(
            @RequestBody(required = false) Map<String, String> body
    ) {
        String sessionId = (body != null) ? body.get("sessionId") : null;
        String prompt = (body != null) ? body.get("prompt") : null;
        String answer = (body != null) ? body.get("answer") : null;

        List<String> suggestions = multimodalAiService.generateDynamicSuggestions(sessionId, prompt, answer);
        return ResponseEntity.ok(Map.of("suggestions", suggestions));
    }

    /**
     * Get list of all conversation sessions for the left sidebar.
     */
    @GetMapping("/chats")
    public ResponseEntity<List<ChatSession>> getAllChatSessions() {
        return ResponseEntity.ok(chatSessionService.getAllSessions());
    }

    /**
     * Get single session message history.
     */
    @GetMapping("/chats/{sessionId}")
    public ResponseEntity<ChatSession> getChatSession(@PathVariable String sessionId) {
        ChatSession session = chatSessionService.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(session);
    }

    /**
     * Create a fresh new chat session.
     */
    @PostMapping("/chats/new")
    public ResponseEntity<ChatSession> createNewChatSession(
            @RequestBody(required = false) Map<String, String> body
    ) {
        String customTitle = (body != null) ? body.get("title") : "New Conversation";
        ChatSession session = chatSessionService.getOrCreateSession(null, customTitle);
        return ResponseEntity.ok(session);
    }

    /**
     * Delete a chat session.
     */
    @DeleteMapping("/chats/{sessionId}")
    public ResponseEntity<Map<String, Object>> deleteChatSession(@PathVariable String sessionId) {
        boolean removed = chatSessionService.deleteSession(sessionId);
        return ResponseEntity.ok(Map.of("sessionId", sessionId, "deleted", removed));
    }

    /**
     * Rename a chat session.
     */
    @PatchMapping("/chats/{sessionId}")
    public ResponseEntity<ChatSession> renameChatSession(
            @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, String> body
    ) {
        String newTitle = (body != null) ? body.get("title") : null;
        ChatSession session = chatSessionService.renameSession(sessionId, newTitle);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(session);
    }

    /**
     * Truncate session starting from a specific message ID (for message editing).
     */
    @DeleteMapping("/chats/{sessionId}/messages/{messageId}")
    public ResponseEntity<Map<String, Object>> truncateSessionFromMessage(
            @PathVariable String sessionId,
            @PathVariable String messageId
    ) {
        boolean truncated = chatSessionService.truncateSessionFromMessage(sessionId, messageId);
        return ResponseEntity.ok(Map.of("sessionId", sessionId, "messageId", messageId, "truncated", truncated));
    }

    /**
     * Clear all chat sessions.
     */
    @DeleteMapping("/chats")
    public ResponseEntity<Map<String, String>> clearAllSessions() {
        chatSessionService.clearAllSessions();
        return ResponseEntity.ok(Map.of("message", "All chat sessions cleared successfully"));
    }

    /**
     * Explains the core architectural concepts of Multimodal AI (RGB pixels, Patching, ViT, Projection Layers).
     */
    @GetMapping("/multimodal/concepts")
    public ResponseEntity<MultimodalConceptExplanation> getMultimodalConcepts() {
        return ResponseEntity.ok(multimodalConceptService.getExplanation());
    }
}
