package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.ProjectContext;
import com.coderarmy.ragsupport.model.UserMemory;
import com.coderarmy.ragsupport.service.UserMemoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller for managing persistent user memory and project contexts across sessions.
 * Allows viewing, adding, updating, toggling status, and clearing memories.
 */
@RestController
@RequestMapping("/api/memories")
@CrossOrigin(origins = "*")
public class MemoryController {

    private final UserMemoryService memoryService;

    public MemoryController(UserMemoryService memoryService) {
        this.memoryService = memoryService;
    }

    /**
     * GET /api/memories
     * List all persistent memories.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getMemories() {
        List<UserMemory> list = memoryService.getAllMemories();
        return ResponseEntity.ok(Map.of(
                "memories", list,
                "count", list.size()
        ));
    }

    /**
     * POST /api/memories
     * Manually add a user memory item.
     */
    @PostMapping
    public ResponseEntity<?> addMemory(@RequestBody Map<String, Object> body) {
        String content = (String) body.get("content");
        String category = (String) body.getOrDefault("category", "GENERAL");
        String status = (String) body.getOrDefault("status", "ACTIVE");
        int importance = 3;
        if (body.containsKey("importance") && body.get("importance") instanceof Number n) {
            importance = n.intValue();
        }

        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Memory content is required"));
        }

        try {
            UserMemory created = memoryService.addMemory(content, category, "manual_entry", status, importance, null, null);
            return ResponseEntity.ok(created);
        } catch (SecurityException se) {
            return ResponseEntity.badRequest().body(Map.of("error", se.getMessage()));
        }
    }

    /**
     * PUT /api/memories/{id}
     * Edit an existing memory.
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateMemory(@PathVariable("id") String id, @RequestBody Map<String, Object> body) {
        String content = (String) body.get("content");
        String category = (String) body.get("category");
        String status = (String) body.get("status");
        Integer importance = null;
        if (body.containsKey("importance") && body.get("importance") instanceof Number n) {
            importance = n.intValue();
        }

        try {
            UserMemory updated = memoryService.updateMemory(id, content, category, status, importance);
            return ResponseEntity.ok(updated);
        } catch (SecurityException se) {
            return ResponseEntity.badRequest().body(Map.of("error", se.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * PATCH /api/memories/{id}/status
     * Toggle status (e.g. ACTIVE -> COMPLETED / RESOLVED / SUPERSEDED).
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable("id") String id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Status is required"));
        }
        boolean ok = memoryService.updateMemoryStatus(id, status);
        if (!ok) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("success", true, "id", id, "status", status.toUpperCase()));
    }

    /**
     * DELETE /api/memories/{id}
     * Delete an individual memory.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteMemory(@PathVariable("id") String id) {
        boolean deleted = memoryService.deleteMemory(id);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("success", true, "id", id));
    }

    /**
     * DELETE /api/memories
     * Clear all user memories.
     */
    @DeleteMapping
    public ResponseEntity<?> clearAllMemories() {
        memoryService.clearAllMemories();
        return ResponseEntity.ok(Map.of("success", true, "message", "All memories cleared"));
    }

    // --- Projects Endpoints ---

    /**
     * GET /api/memories/projects
     * List all tracked project contexts.
     */
    @GetMapping("/projects")
    public ResponseEntity<Map<String, Object>> getProjects() {
        List<ProjectContext> list = memoryService.getAllProjects();
        return ResponseEntity.ok(Map.of(
                "projects", list,
                "count", list.size()
        ));
    }

    /**
     * POST /api/memories/projects
     * Save or update a project context.
     */
    @PostMapping("/projects")
    public ResponseEntity<?> saveProject(@RequestBody ProjectContext project) {
        try {
            ProjectContext saved = memoryService.saveOrUpdateProject(project);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * DELETE /api/memories/projects/{id}
     * Delete a tracked project context.
     */
    @DeleteMapping("/projects/{id}")
    public ResponseEntity<?> deleteProject(@PathVariable("id") String id) {
        boolean ok = memoryService.deleteProject(id);
        if (!ok) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("success", true, "id", id));
    }
}
