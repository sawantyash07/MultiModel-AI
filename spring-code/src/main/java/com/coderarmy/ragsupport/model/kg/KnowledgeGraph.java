package com.coderarmy.ragsupport.model.kg;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Encapsulates the complete or neighborhood view of the Knowledge Graph.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KnowledgeGraph {

    private List<KnowledgeNode> nodes = new ArrayList<>();
    private List<KnowledgeEdge> edges = new ArrayList<>();
    private int totalNodes;
    private int totalEdges;
    private String updatedAt;
    private String lastSyncTime;

    public KnowledgeGraph() {
        this.updatedAt = Instant.now().toString();
        this.lastSyncTime = this.updatedAt;
    }

    public KnowledgeGraph(List<KnowledgeNode> nodes, List<KnowledgeEdge> edges) {
        this();
        this.nodes = (nodes != null) ? nodes : new ArrayList<>();
        this.edges = (edges != null) ? edges : new ArrayList<>();
        this.totalNodes = this.nodes.size();
        this.totalEdges = this.edges.size();
    }

    public List<KnowledgeNode> getNodes() {
        return nodes;
    }

    public void setNodes(List<KnowledgeNode> nodes) {
        this.nodes = (nodes != null) ? nodes : new ArrayList<>();
        this.totalNodes = this.nodes.size();
    }

    public List<KnowledgeEdge> getEdges() {
        return edges;
    }

    public void setEdges(List<KnowledgeEdge> edges) {
        this.edges = (edges != null) ? edges : new ArrayList<>();
        this.totalEdges = this.edges.size();
    }

    public int getTotalNodes() {
        return totalNodes;
    }

    public void setTotalNodes(int totalNodes) {
        this.totalNodes = totalNodes;
    }

    public int getTotalEdges() {
        return totalEdges;
    }

    public void setTotalEdges(int totalEdges) {
        this.totalEdges = totalEdges;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getLastSyncTime() {
        return lastSyncTime;
    }

    public void setLastSyncTime(String lastSyncTime) {
        this.lastSyncTime = lastSyncTime;
    }
}
