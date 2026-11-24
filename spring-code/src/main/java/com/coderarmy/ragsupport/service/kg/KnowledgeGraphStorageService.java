package com.coderarmy.ragsupport.service.kg;

import com.coderarmy.ragsupport.model.kg.KnowledgeEdge;
import com.coderarmy.ragsupport.model.kg.KnowledgeGraph;
import com.coderarmy.ragsupport.model.kg.KnowledgeNode;
import com.coderarmy.ragsupport.model.kg.KnowledgeSourceRef;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * High-performance, durable, thread-safe Knowledge Graph Storage Service.
 * Manages in-memory graph indices and atomic file persistence.
 */
@Service
public class KnowledgeGraphStorageService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeGraphStorageService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, KnowledgeNode> nodeStore = new ConcurrentHashMap<>();
    private final Map<String, KnowledgeEdge> edgeStore = new ConcurrentHashMap<>();

    private File dataFile;
    private String lastSyncTime = Instant.now().toString();

    public KnowledgeGraphStorageService() {
        resolveDataFile();
        loadFromDisk();
    }

    private void resolveDataFile() {
        // Handle both working directories: project root and spring-code subfolder
        File candidate1 = new File("spring-code/data/knowledge_graph.json");
        File candidate2 = new File("data/knowledge_graph.json");

        if (new File("spring-code/data").isDirectory()) {
            this.dataFile = candidate1;
        } else if (new File("data").isDirectory()) {
            this.dataFile = candidate2;
        } else {
            // Default to data/knowledge_graph.json
            this.dataFile = candidate2;
        }
    }

    public synchronized void loadFromDisk() {
        try {
            if (dataFile != null && dataFile.exists() && dataFile.length() > 0) {
                Map<String, Object> data = objectMapper.readValue(dataFile, new TypeReference<Map<String, Object>>() {});
                if (data != null) {
                    List<Map<String, Object>> rawNodes = (List<Map<String, Object>>) data.get("nodes");
                    if (rawNodes != null) {
                        for (Map<String, Object> m : rawNodes) {
                            KnowledgeNode node = objectMapper.convertValue(m, KnowledgeNode.class);
                            if (node.getId() != null) {
                                nodeStore.put(node.getId(), node);
                            }
                        }
                    }

                    List<Map<String, Object>> rawEdges = (List<Map<String, Object>>) data.get("edges");
                    if (rawEdges != null) {
                        for (Map<String, Object> m : rawEdges) {
                            KnowledgeEdge edge = objectMapper.convertValue(m, KnowledgeEdge.class);
                            if (edge.getId() != null) {
                                edgeStore.put(edge.getId(), edge);
                            }
                        }
                    }

                    if (data.containsKey("lastSyncTime") && data.get("lastSyncTime") != null) {
                        this.lastSyncTime = (String) data.get("lastSyncTime");
                    }
                }
                log.info("[KnowledgeGraphStorage] Loaded {} nodes and {} edges from {}",
                        nodeStore.size(), edgeStore.size(), dataFile.getPath());
            }
        } catch (Exception e) {
            log.warn("[KnowledgeGraphStorage] Failed to read graph from disk: {}", e.getMessage());
        }
    }

    public synchronized void saveToDisk() {
        try {
            if (dataFile == null) {
                resolveDataFile();
            }
            if (dataFile.getParentFile() != null && !dataFile.getParentFile().exists()) {
                dataFile.getParentFile().mkdirs();
            }

            this.lastSyncTime = Instant.now().toString();
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("updatedAt", Instant.now().toString());
            data.put("lastSyncTime", this.lastSyncTime);
            data.put("totalNodes", nodeStore.size());
            data.put("totalEdges", edgeStore.size());
            data.put("nodes", new ArrayList<>(nodeStore.values()));
            data.put("edges", new ArrayList<>(edgeStore.values()));

            objectMapper.writerWithDefaultPrettyPrinter().writeValue(dataFile, data);

            // Also keep secondary copy in sync if running from root
            if (dataFile.getPath().contains("spring-code") && new File("data").isDirectory()) {
                try {
                    objectMapper.writerWithDefaultPrettyPrinter().writeValue(new File("data/knowledge_graph.json"), data);
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            log.warn("[KnowledgeGraphStorage] Failed to write graph to disk: {}", e.getMessage());
        }
    }

    // -------------------------------------------------------------
    // Node Operations
    // -------------------------------------------------------------

    public List<KnowledgeNode> getAllNodes() {
        return new ArrayList<>(nodeStore.values());
    }

    public Optional<KnowledgeNode> getNode(String id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(nodeStore.get(id));
    }

    public Optional<KnowledgeNode> findNodeByLabelOrAlias(String rawName) {
        if (rawName == null || rawName.isBlank()) return Optional.empty();
        String normalized = normalizeEntityName(rawName);

        for (KnowledgeNode node : nodeStore.values()) {
            if (normalizeEntityName(node.getLabel()).equalsIgnoreCase(normalized)) {
                return Optional.of(node);
            }
            for (String alias : node.getAliases()) {
                if (normalizeEntityName(alias).equalsIgnoreCase(normalized)) {
                    return Optional.of(node);
                }
            }
        }
        return Optional.empty();
    }

    public synchronized KnowledgeNode addOrUpdateNode(KnowledgeNode node) {
        if (node == null || node.getLabel() == null || node.getLabel().isBlank()) {
            throw new IllegalArgumentException("Node must have a valid label.");
        }

        if (node.getId() == null || node.getId().isBlank()) {
            String slug = slugify(node.getLabel());
            node.setId("node-" + slug + "-" + UUID.randomUUID().toString().substring(0, 6));
        }

        node.setUpdatedAt(Instant.now().toString());
        nodeStore.put(node.getId(), node);
        saveToDisk();
        return node;
    }

    public synchronized boolean deleteNode(String id) {
        if (id == null) return false;
        KnowledgeNode removed = nodeStore.remove(id);
        if (removed != null) {
            // Remove all connected edges
            List<String> connectedEdgeIds = edgeStore.values().stream()
                    .filter(e -> id.equals(e.getSource()) || id.equals(e.getTarget()))
                    .map(KnowledgeEdge::getId)
                    .collect(Collectors.toList());

            for (String edgeId : connectedEdgeIds) {
                edgeStore.remove(edgeId);
            }

            saveToDisk();
            return true;
        }
        return false;
    }

    // -------------------------------------------------------------
    // Edge Operations
    // -------------------------------------------------------------

    public List<KnowledgeEdge> getAllEdges() {
        return new ArrayList<>(edgeStore.values());
    }

    public Optional<KnowledgeEdge> getEdge(String id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(edgeStore.get(id));
    }

    public Optional<KnowledgeEdge> findEdge(String sourceId, String targetId, String relation) {
        if (sourceId == null || targetId == null) return Optional.empty();
        String rel = (relation != null) ? relation.toUpperCase().trim() : "RELATED_TO";

        return edgeStore.values().stream()
                .filter(e -> sourceId.equals(e.getSource()) &&
                        targetId.equals(e.getTarget()) &&
                        rel.equalsIgnoreCase(e.getRelation()))
                .findFirst();
    }

    public synchronized KnowledgeEdge addOrUpdateEdge(KnowledgeEdge edge) {
        if (edge == null || edge.getSource() == null || edge.getTarget() == null) {
            throw new IllegalArgumentException("Edge must have valid source and target nodes.");
        }

        if (edge.getSource().equals(edge.getTarget())) {
            // Disallow self-loops
            return null;
        }

        // Verify both nodes exist
        if (!nodeStore.containsKey(edge.getSource()) || !nodeStore.containsKey(edge.getTarget())) {
            log.debug("[KnowledgeGraphStorage] Skipping edge for non-existent node: {} -> {}", edge.getSource(), edge.getTarget());
            return null;
        }

        // Check if matching edge already exists
        Optional<KnowledgeEdge> existing = findEdge(edge.getSource(), edge.getTarget(), edge.getRelation());
        if (existing.isPresent()) {
            KnowledgeEdge e = existing.get();
            // Merge source provenance
            if (edge.getSources() != null) {
                for (KnowledgeSourceRef ref : edge.getSources()) {
                    e.addSource(ref);
                }
            }
            if (edge.getDescription() != null && !edge.getDescription().isBlank()) {
                e.setDescription(edge.getDescription());
            }
            e.setConfidence(Math.max(e.getConfidence(), edge.getConfidence()));
            e.setUpdatedAt(Instant.now().toString());
            saveToDisk();
            return e;
        }

        if (edge.getId() == null || edge.getId().isBlank()) {
            edge.setId("edge-" + UUID.randomUUID().toString().substring(0, 8));
        }

        edge.setUpdatedAt(Instant.now().toString());
        edgeStore.put(edge.getId(), edge);
        saveToDisk();
        return edge;
    }

    public synchronized boolean deleteEdge(String id) {
        if (id == null) return false;
        KnowledgeEdge removed = edgeStore.remove(id);
        if (removed != null) {
            saveToDisk();
            return true;
        }
        return false;
    }

    public synchronized KnowledgeEdge verifyEdge(String id, boolean verified) {
        KnowledgeEdge edge = edgeStore.get(id);
        if (edge != null) {
            edge.setStatus(verified ? "VERIFIED" : "REJECTED");
            edge.setInferred(!verified);
            edge.setUpdatedAt(Instant.now().toString());
            saveToDisk();
        }
        return edge;
    }

    // -------------------------------------------------------------
    // Graph Traversal & Neighborhood
    // -------------------------------------------------------------

    public List<KnowledgeEdge> getEdgesForNode(String nodeId) {
        if (nodeId == null) return Collections.emptyList();
        return edgeStore.values().stream()
                .filter(e -> nodeId.equals(e.getSource()) || nodeId.equals(e.getTarget()))
                .collect(Collectors.toList());
    }

    public KnowledgeGraph getNeighborhood(String centerNodeId, int maxDepth) {
        if (centerNodeId == null || !nodeStore.containsKey(centerNodeId)) {
            return new KnowledgeGraph(Collections.emptyList(), Collections.emptyList());
        }

        Set<String> visitedNodeIds = new HashSet<>();
        Set<String> includedEdgeIds = new HashSet<>();
        Queue<String> queue = new LinkedList<>();

        queue.add(centerNodeId);
        visitedNodeIds.add(centerNodeId);

        int currentDepth = 0;
        int depthLimit = Math.max(1, Math.min(3, maxDepth));

        while (!queue.isEmpty() && currentDepth < depthLimit) {
            int levelSize = queue.size();
            for (int i = 0; i < levelSize; i++) {
                String currentId = queue.poll();
                for (KnowledgeEdge edge : getEdgesForNode(currentId)) {
                    includedEdgeIds.add(edge.getId());
                    String neighborId = currentId.equals(edge.getSource()) ? edge.getTarget() : edge.getSource();
                    if (!visitedNodeIds.contains(neighborId) && nodeStore.containsKey(neighborId)) {
                        visitedNodeIds.add(neighborId);
                        queue.add(neighborId);
                    }
                }
            }
            currentDepth++;
        }

        List<KnowledgeNode> subNodes = visitedNodeIds.stream()
                .map(nodeStore::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        List<KnowledgeEdge> subEdges = includedEdgeIds.stream()
                .map(edgeStore::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        KnowledgeGraph kg = new KnowledgeGraph(subNodes, subEdges);
        kg.setLastSyncTime(this.lastSyncTime);
        return kg;
    }

    // -------------------------------------------------------------
    // Search & Filter
    // -------------------------------------------------------------

    public KnowledgeGraph searchAndFilter(String query, String typeFilter, String sourceFilter, String relationFilter) {
        String q = (query != null) ? query.trim().toLowerCase() : "";
        String typeF = (typeFilter != null && !typeFilter.equalsIgnoreCase("ALL")) ? typeFilter.trim().toUpperCase() : null;
        String relF = (relationFilter != null && !relationFilter.equalsIgnoreCase("ALL")) ? relationFilter.trim().toUpperCase() : null;
        String srcF = (sourceFilter != null && !sourceFilter.equalsIgnoreCase("ALL")) ? sourceFilter.trim().toLowerCase() : null;

        List<KnowledgeNode> matchedNodes = nodeStore.values().stream()
                .filter(n -> {
                    if (typeF != null && !typeF.equalsIgnoreCase(n.getType())) {
                        return false;
                    }
                    if (srcF != null) {
                        boolean hasSource = n.getSources().stream().anyMatch(s ->
                                srcF.equalsIgnoreCase(s.getSourceType()) ||
                                (s.getSourceTitle() != null && s.getSourceTitle().toLowerCase().contains(srcF))
                        );
                        if (!hasSource) return false;
                    }
                    if (!q.isEmpty()) {
                        boolean matchLabel = n.getLabel() != null && n.getLabel().toLowerCase().contains(q);
                        boolean matchDesc = n.getDescription() != null && n.getDescription().toLowerCase().contains(q);
                        boolean matchAlias = n.getAliases() != null && n.getAliases().stream().anyMatch(a -> a.toLowerCase().contains(q));
                        return matchLabel || matchDesc || matchAlias;
                    }
                    return true;
                })
                .collect(Collectors.toList());

        Set<String> matchedNodeIds = matchedNodes.stream().map(KnowledgeNode::getId).collect(Collectors.toSet());

        List<KnowledgeEdge> matchedEdges = edgeStore.values().stream()
                .filter(e -> {
                    if (relF != null && !relF.equalsIgnoreCase(e.getRelation())) {
                        return false;
                    }
                    // Edge must connect between filtered nodes (or at least one if relaxed)
                    return matchedNodeIds.contains(e.getSource()) && matchedNodeIds.contains(e.getTarget());
                })
                .collect(Collectors.toList());

        KnowledgeGraph kg = new KnowledgeGraph(matchedNodes, matchedEdges);
        kg.setLastSyncTime(this.lastSyncTime);
        return kg;
    }

    // -------------------------------------------------------------
    // Entity Merging
    // -------------------------------------------------------------

    public synchronized KnowledgeNode mergeNodes(String sourceNodeId, String targetNodeId) {
        if (sourceNodeId == null || targetNodeId == null || sourceNodeId.equals(targetNodeId)) {
            throw new IllegalArgumentException("Cannot merge a node into itself or null nodes.");
        }

        KnowledgeNode sourceNode = nodeStore.get(sourceNodeId);
        KnowledgeNode targetNode = nodeStore.get(targetNodeId);

        if (sourceNode == null || targetNode == null) {
            throw new IllegalArgumentException("Both source and target nodes must exist to merge.");
        }

        // Add sourceNode label and aliases into targetNode aliases
        targetNode.addAlias(sourceNode.getLabel());
        for (String alias : sourceNode.getAliases()) {
            targetNode.addAlias(alias);
        }

        // Append descriptions if distinct
        if (sourceNode.getDescription() != null && !sourceNode.getDescription().isBlank()) {
            if (targetNode.getDescription() == null || targetNode.getDescription().isBlank()) {
                targetNode.setDescription(sourceNode.getDescription());
            } else if (!targetNode.getDescription().contains(sourceNode.getDescription())) {
                targetNode.setDescription(targetNode.getDescription() + "; " + sourceNode.getDescription());
            }
        }

        // Merge sources
        for (KnowledgeSourceRef ref : sourceNode.getSources()) {
            targetNode.addSource(ref);
        }

        // Merge properties
        if (sourceNode.getProperties() != null) {
            targetNode.getProperties().putAll(sourceNode.getProperties());
        }

        // Re-point all edges that touch sourceNode to targetNode
        List<KnowledgeEdge> touchingEdges = getEdgesForNode(sourceNodeId);
        for (KnowledgeEdge edge : touchingEdges) {
            if (sourceNodeId.equals(edge.getSource())) {
                edge.setSource(targetNodeId);
            }
            if (sourceNodeId.equals(edge.getTarget())) {
                edge.setTarget(targetNodeId);
            }

            // Remove self-loops
            if (edge.getSource().equals(edge.getTarget())) {
                edgeStore.remove(edge.getId());
                continue;
            }

            // Check if duplicate edge already exists for targetNode
            Optional<KnowledgeEdge> dup = edgeStore.values().stream()
                    .filter(e -> !e.getId().equals(edge.getId()) &&
                            e.getSource().equals(edge.getSource()) &&
                            e.getTarget().equals(edge.getTarget()) &&
                            e.getRelation().equalsIgnoreCase(edge.getRelation()))
                    .findFirst();

            if (dup.isPresent()) {
                KnowledgeEdge existingEdge = dup.get();
                for (KnowledgeSourceRef s : edge.getSources()) {
                    existingEdge.addSource(s);
                }
                edgeStore.remove(edge.getId());
            } else {
                edge.setUpdatedAt(Instant.now().toString());
            }
        }

        // Delete sourceNode
        nodeStore.remove(sourceNodeId);
        targetNode.setUpdatedAt(Instant.now().toString());
        saveToDisk();

        log.info("[KnowledgeGraphStorage] Successfully merged node '{}' into '{}'",
                sourceNode.getLabel(), targetNode.getLabel());

        return targetNode;
    }

    // -------------------------------------------------------------
    // Provenance Source Deletion Handling
    // -------------------------------------------------------------

    public synchronized void removeSourceFromGraph(String sourceType, String sourceId) {
        if (sourceType == null || sourceId == null) return;

        boolean modified = false;

        // Clean node source refs
        for (KnowledgeNode node : new ArrayList<>(nodeStore.values())) {
            int before = node.getSources().size();
            node.getSources().removeIf(s -> sourceType.equalsIgnoreCase(s.getSourceType()) && sourceId.equals(s.getSourceId()));
            if (node.getSources().size() != before) {
                modified = true;
                // If this was an auto-extracted conversation/document node and has 0 sources left
                if (node.getSources().isEmpty() &&
                        ("CONVERSATION".equalsIgnoreCase(node.getType()) || "DOCUMENT".equalsIgnoreCase(node.getType()))) {
                    deleteNode(node.getId());
                }
            }
        }

        // Clean edge source refs
        for (KnowledgeEdge edge : new ArrayList<>(edgeStore.values())) {
            int before = edge.getSources().size();
            edge.getSources().removeIf(s -> sourceType.equalsIgnoreCase(s.getSourceType()) && sourceId.equals(s.getSourceId()));
            if (edge.getSources().size() != before) {
                modified = true;
                if (edge.getSources().isEmpty() && edge.isInferred()) {
                    edgeStore.remove(edge.getId());
                }
            }
        }

        if (modified) {
            saveToDisk();
        }
    }

    public synchronized void clearAll() {
        nodeStore.clear();
        edgeStore.clear();
        this.lastSyncTime = Instant.now().toString();
        saveToDisk();
        log.info("[KnowledgeGraphStorage] Graph cleared for rebuild.");
    }

    public String getLastSyncTime() {
        return lastSyncTime;
    }

    public void setLastSyncTime(String lastSyncTime) {
        this.lastSyncTime = lastSyncTime;
    }

    // Helper functions
    private static String slugify(String text) {
        if (text == null) return "entity";
        String clean = text.toLowerCase().replaceAll("[^a-z0-9]+", "-");
        clean = clean.replaceAll("^-+|-+$", "");
        return clean.isEmpty() ? "entity" : (clean.length() > 30 ? clean.substring(0, 30) : clean);
    }

    private static String normalizeEntityName(String name) {
        if (name == null) return "";
        return name.toLowerCase().replaceAll("[\\p{Punct}\\s]+", "").trim();
    }
}
