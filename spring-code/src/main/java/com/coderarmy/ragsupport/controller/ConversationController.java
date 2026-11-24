package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.Conversation;
import com.coderarmy.ragsupport.service.ConversationStorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/conversations")
@CrossOrigin(origins = "*")
public class ConversationController {

    private final ConversationStorageService storageService;

    public ConversationController(ConversationStorageService storageService) {
        this.storageService = storageService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getConversations(@RequestParam(value = "q", required = false) String query) {
        return ResponseEntity.ok(Map.of("conversations", storageService.getAllConversations(query)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getConversation(@PathVariable("id") String id) {
        Conversation conv = storageService.getConversation(id);
        if (conv == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(conv);
    }

    @PostMapping
    public ResponseEntity<Conversation> createConversation(@RequestBody(required = false) Map<String, Object> body) {
        String title = (body != null && body.containsKey("title")) ? (String) body.get("title") : null;
        String firstPrompt = (body != null && body.containsKey("firstPrompt")) ? (String) body.get("firstPrompt") : null;
        String modelId = (body != null && body.containsKey("modelId")) ? (String) body.get("modelId") : "auto";

        if ((title == null || title.isBlank() || title.equalsIgnoreCase("New Chat")) && firstPrompt != null && !firstPrompt.isBlank()) {
            title = ConversationStorageService.generateTitleFromPrompt(firstPrompt);
        }

        return ResponseEntity.ok(storageService.createConversation(title, modelId));
    }

    /**
     * PUT /api/conversations/{id}/messages/{messageId}
     * Update/edit an individual message content.
     */
    @PutMapping("/{id}/messages/{messageId}")
    public ResponseEntity<?> updateMessage(
            @PathVariable("id") String id,
            @PathVariable("messageId") String messageId,
            @RequestBody Map<String, Object> body
    ) {
        String content = (body != null) ? (String) body.get("content") : null;
        if (content == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Message content is required"));
        }
        boolean updated = storageService.updateMessage(id, messageId, content);
        if (!updated) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("message", "Message updated successfully", "id", messageId));
    }

    /**
     * PUT /api/conversations/{id}/messages
     * Replace message list in a conversation (used when trimming after editing user prompt).
     */
    @PutMapping("/{id}/messages")
    public ResponseEntity<?> replaceMessages(
            @PathVariable("id") String id,
            @RequestBody Map<String, Object> body
    ) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> messages = (body != null) ? (List<Map<String, Object>>) body.get("messages") : null;
        if (messages == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Messages array is required"));
        }
        boolean replaced = storageService.replaceMessages(id, messages);
        if (!replaced) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("message", "Conversation messages replaced successfully", "id", id));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> renameConversation(@PathVariable("id") String id, @RequestBody Map<String, Object> body) {
        String title = (body != null) ? (String) body.get("title") : "";
        if (title == null || title.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Title is required"));
        }
        Conversation conv = storageService.updateTitle(id, title);
        if (conv == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(conv);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteConversation(@PathVariable("id") String id) {
        boolean removed = storageService.deleteConversation(id);
        if (!removed) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("message", "Conversation deleted successfully", "id", id));
    }

    @DeleteMapping
    public ResponseEntity<?> clearAllConversations() {
        storageService.clearAll();
        return ResponseEntity.ok(Map.of("message", "All conversations cleared successfully"));
    }

    @GetMapping("/{id}/highlights")
    public ResponseEntity<?> getHighlights(@PathVariable("id") String id) {
        return ResponseEntity.ok(Map.of("highlights", storageService.getHighlights(id)));
    }

    @PostMapping("/{id}/highlights")
    public ResponseEntity<?> saveHighlight(
            @PathVariable("id") String id,
            @RequestBody Map<String, Object> highlight
    ) {
        if (highlight == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Highlight data is required"));
        }
        Map<String, Object> saved = storageService.addOrUpdateHighlight(id, highlight);
        if (saved == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}/highlights/{highlightId}")
    public ResponseEntity<?> deleteHighlight(
            @PathVariable("id") String id,
            @PathVariable("highlightId") String highlightId
    ) {
        boolean removed = storageService.removeHighlight(id, highlightId);
        return ResponseEntity.ok(Map.of("success", removed, "id", highlightId));
    }

    @DeleteMapping("/{id}/highlights")
    public ResponseEntity<?> clearHighlights(
            @PathVariable("id") String id,
            @RequestParam(value = "messageId", required = false) String messageId
    ) {
        boolean cleared = storageService.clearHighlights(id, messageId);
        return ResponseEntity.ok(Map.of("success", cleared));
    }
}
