package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.kg.*;
import com.coderarmy.ragsupport.service.kg.KnowledgeExtractionPipeline;
import com.coderarmy.ragsupport.service.kg.KnowledgeGraphQueryService;
import com.coderarmy.ragsupport.service.kg.KnowledgeGraphStorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * REST API Controller for Personal Knowledge Graph.
 * Provides endpoints for graph queries, neighborhood exploration, Q&A, CRUD, and synchronization.
 */
@RestController
@RequestMapping("/api/knowledge-graph")
@CrossOrigin(origins = "*")
public class KnowledgeGraphController {

    private final KnowledgeGraphStorageService storageService;
    private final KnowledgeExtractionPipeline extractionPipeline;
    private final KnowledgeGraphQueryService queryService;

    @Autowired
    public KnowledgeGraphController(
            KnowledgeGraphStorageService storageService,
            KnowledgeExtractionPipeline extractionPipeline,
            KnowledgeGraphQueryService queryService
    ) {
        this.storageService = storageService;
        this.extractionPipeline = extractionPipeline;
        this.queryService = queryService;
    }

    /**
     * GET /api/knowledge-graph
     * Retrieves graph elements with optional search, category, and source filters.
     */
    @GetMapping
    public ResponseEntity<KnowledgeGraph> getKnowledgeGraph(
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "source", required = false) String source,
            @RequestParam(value = "relation", required = false) String relation
    ) {
        if ((query != null && !query.isBlank()) ||
            (type != null && !type.isBlank()) ||
            (source != null && !source.isBlank()) ||
            (relation != null && !relation.isBlank())) {
            KnowledgeGraph filtered = storageService.searchAndFilter(query, type, source, relation);
            return ResponseEntity.ok(filtered);
        }

        KnowledgeGraph fullGraph = new KnowledgeGraph(storageService.getAllNodes(), storageService.getAllEdges());
        fullGraph.setLastSyncTime(storageService.getLastSyncTime());
        return ResponseEntity.ok(fullGraph);
    }

    /**
     * GET /api/knowledge-graph/nodes/{id}
     * Retrieves a single node along with its incident edges.
     */
    @GetMapping("/nodes/{id}")
    public ResponseEntity<Map<String, Object>> getNodeDetails(@PathVariable("id") String id) {
        Optional<KnowledgeNode> node = storageService.getNode(id);
        if (node.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Node not found with ID: " + id));
        }

        List<KnowledgeEdge> edges = storageService.getEdgesForNode(id);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("node", node.get());
        response.put("edges", edges);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/knowledge-graph/nodes/{id}/connections
     * Retrieves the 1-hop or 2-hop neighborhood surrounding the designated node.
     */
    @GetMapping("/nodes/{id}/connections")
    public ResponseEntity<KnowledgeGraph> getNodeNeighborhood(
            @PathVariable("id") String id,
            @RequestParam(value = "depth", defaultValue = "1") int depth
    ) {
        KnowledgeGraph neighborhood = storageService.getNeighborhood(id, depth);
        return ResponseEntity.ok(neighborhood);
    }

    /**
     * GET /api/knowledge-graph/search
     * Fast search endpoint across names, aliases, and descriptions.
     */
    @GetMapping("/search")
    public ResponseEntity<KnowledgeGraph> searchGraph(
            @RequestParam("q") String query,
            @RequestParam(value = "type", required = false) String type
    ) {
        KnowledgeGraph results = storageService.searchAndFilter(query, type, null, null);
        return ResponseEntity.ok(results);
    }

    /**
     * POST /api/knowledge-graph/nodes
     * Creates a new user-defined knowledge node.
     */
    @PostMapping("/nodes")
    public ResponseEntity<KnowledgeNode> createNode(@RequestBody KnowledgeNode node) {
        if (node.getLabel() == null || node.getLabel().isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        KnowledgeSourceRef manualSource = new KnowledgeSourceRef("manual", "user", "Manual Entry", "Created by user in Knowledge Graph");
        node.addSource(manualSource);

        KnowledgeNode created = storageService.addOrUpdateNode(node);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * PATCH /api/knowledge-graph/nodes/{id}
     * Updates an existing node's label, description, type, aliases, or status.
     */
    @PatchMapping("/nodes/{id}")
    public ResponseEntity<KnowledgeNode> updateNode(
            @PathVariable("id") String id,
            @RequestBody Map<String, Object> updates
    ) {
        Optional<KnowledgeNode> opt = storageService.getNode(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        KnowledgeNode node = opt.get();
        if (updates.containsKey("label") && updates.get("label") != null) {
            node.setLabel((String) updates.get("label"));
        }
        if (updates.containsKey("description")) {
            node.setDescription((String) updates.get("description"));
        }
        if (updates.containsKey("type") && updates.get("type") != null) {
            node.setType((String) updates.get("type"));
        }
        if (updates.containsKey("status") && updates.get("status") != null) {
            node.setStatus((String) updates.get("status"));
        }
        if (updates.containsKey("aliases") && updates.get("aliases") instanceof List) {
            node.setAliases((List<String>) updates.get("aliases"));
        }

        storageService.addOrUpdateNode(node);
        return ResponseEntity.ok(node);
    }

    /**
     * DELETE /api/knowledge-graph/nodes/{id}
     * Deletes a knowledge node and its connected edges.
     */
    @DeleteMapping("/nodes/{id}")
    public ResponseEntity<Map<String, Object>> deleteNode(@PathVariable("id") String id) {
        boolean deleted = storageService.deleteNode(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("status", "success", "message", "Node deleted successfully", "id", id));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("status", "error", "message", "Node not found with id: " + id));
        }
    }

    /**
     * POST /api/knowledge-graph/edges
     * Creates a new relationship edge between two nodes.
     */
    @PostMapping("/edges")
    public ResponseEntity<?> createEdge(@RequestBody KnowledgeEdge edge) {
        if (edge.getSource() == null || edge.getTarget() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Source and target are required."));
        }

        KnowledgeSourceRef manualSource = new KnowledgeSourceRef("manual", "user", "Manual Entry", "Connected manually by user");
        edge.addSource(manualSource);

        KnowledgeEdge created = storageService.addOrUpdateEdge(edge);
        if (created == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Could not create edge. Check that nodes exist and are not identical."));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * PATCH /api/knowledge-graph/edges/{id}
     * Updates an edge's label, description, or relation.
     */
    @PatchMapping("/edges/{id}")
    public ResponseEntity<KnowledgeEdge> updateEdge(
            @PathVariable("id") String id,
            @RequestBody Map<String, Object> updates
    ) {
        Optional<KnowledgeEdge> opt = storageService.getEdge(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        KnowledgeEdge edge = opt.get();
        if (updates.containsKey("relation") && updates.get("relation") != null) {
            edge.setRelation((String) updates.get("relation"));
        }
        if (updates.containsKey("label") && updates.get("label") != null) {
            edge.setLabel((String) updates.get("label"));
        }
        if (updates.containsKey("description")) {
            edge.setDescription((String) updates.get("description"));
        }
        if (updates.containsKey("status") && updates.get("status") != null) {
            edge.setStatus((String) updates.get("status"));
        }

        storageService.addOrUpdateEdge(edge);
        return ResponseEntity.ok(edge);
    }

    /**
     * DELETE /api/knowledge-graph/edges/{id}
     * Deletes a relationship edge.
     */
    @DeleteMapping("/edges/{id}")
    public ResponseEntity<Map<String, Object>> deleteEdge(@PathVariable("id") String id) {
        boolean deleted = storageService.deleteEdge(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("status", "success", "message", "Edge deleted successfully", "id", id));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("status", "error", "message", "Edge not found with id: " + id));
        }
    }

    /**
     * POST /api/knowledge-graph/edges/{id}/verify
     * Confirms or rejects an inferred relationship.
     */
    @PostMapping("/edges/{id}/verify")
    public ResponseEntity<KnowledgeEdge> verifyEdge(
            @PathVariable("id") String id,
            @RequestParam("verified") boolean verified
    ) {
        KnowledgeEdge updated = storageService.verifyEdge(id, verified);
        if (updated != null) {
            return ResponseEntity.ok(updated);
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    /**
     * POST /api/knowledge-graph/nodes/merge
     * Merges a source node into a target node.
     */
    @PostMapping("/nodes/merge")
    public ResponseEntity<?> mergeNodes(@RequestBody Map<String, String> request) {
        String sourceId = request.get("sourceNodeId");
        String targetId = request.get("targetNodeId");

        try {
            KnowledgeNode merged = storageService.mergeNodes(sourceId, targetId);
            return ResponseEntity.ok(merged);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/knowledge-graph/rebuild
     * Synchronizes and rebuilds knowledge from all conversations, memories, and documents.
     */
    @PostMapping("/rebuild")
    public ResponseEntity<Map<String, Object>> rebuildGraph() {
        Map<String, Object> result = extractionPipeline.rebuildFromAllSources();
        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/knowledge-graph/extract
     * Triggers extraction for an exchange or conversation.
     */
    @PostMapping("/extract")
    public ResponseEntity<Map<String, Object>> extractKnowledge(
            @RequestBody(required = false) Map<String, String> request
    ) {
        if (request != null && request.containsKey("conversationId")) {
            String convId = request.get("conversationId");
            String title = request.getOrDefault("title", "Conversation");
            String prompt = request.getOrDefault("prompt", "");
            String answer = request.getOrDefault("answer", "");
            extractionPipeline.extractFromExchange(convId, title, prompt, answer);
            return ResponseEntity.ok(Map.of("status", "success", "message", "Extracted knowledge for conversation: " + convId));
        } else {
            Map<String, Object> result = extractionPipeline.rebuildFromAllSources();
            return ResponseEntity.ok(result);
        }
    }

    /**
     * POST /api/knowledge-graph/ask
     * Answers questions grounded strictly in the Knowledge Graph with provenance citations.
     */
    @PostMapping("/ask")
    public ResponseEntity<KnowledgeAskResponse> askKnowledgeGraph(@RequestBody KnowledgeAskRequest request) {
        KnowledgeAskResponse response = queryService.ask(request);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/knowledge-graph/insights
     * Returns evidence-based summary analytics, degree centrality, and project breakdowns.
     */
    @GetMapping("/insights")
    public ResponseEntity<KnowledgeGraphInsights> getInsights() {
        KnowledgeGraphInsights insights = queryService.computeInsights();
        return ResponseEntity.ok(insights);
    }
}
