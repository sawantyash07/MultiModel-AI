package com.coderarmy.ragsupport.model.kg;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.*;

/**
 * Evidence-based analytical insights calculated from the Knowledge Graph network topology.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KnowledgeGraphInsights {

    private int totalNodes;
    private int totalEdges;
    private Map<String, Integer> nodesByType = new LinkedHashMap<>();
    private Map<String, Integer> edgesByRelation = new LinkedHashMap<>();
    private List<Map<String, Object>> mostConnectedEntities = new ArrayList<>();
    private List<Map<String, Object>> projectsWithTech = new ArrayList<>();
    private List<Map<String, Object>> decisionsByProject = new ArrayList<>();
    private List<Map<String, Object>> crossSourceEntities = new ArrayList<>();
    private List<Map<String, Object>> unresolvedTasks = new ArrayList<>();
    private List<Map<String, Object>> supersededOrOutdated = new ArrayList<>();
    private Map<String, Integer> evidenceDistribution = new LinkedHashMap<>();
    private String lastSyncTime;

    public KnowledgeGraphInsights() {
        this.lastSyncTime = Instant.now().toString();
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

    public Map<String, Integer> getNodesByType() {
        return nodesByType;
    }

    public void setNodesByType(Map<String, Integer> nodesByType) {
        this.nodesByType = nodesByType;
    }

    public Map<String, Integer> getEdgesByRelation() {
        return edgesByRelation;
    }

    public void setEdgesByRelation(Map<String, Integer> edgesByRelation) {
        this.edgesByRelation = edgesByRelation;
    }

    public List<Map<String, Object>> getMostConnectedEntities() {
        return mostConnectedEntities;
    }

    public void setMostConnectedEntities(List<Map<String, Object>> mostConnectedEntities) {
        this.mostConnectedEntities = mostConnectedEntities;
    }

    public List<Map<String, Object>> getProjectsWithTech() {
        return projectsWithTech;
    }

    public void setProjectsWithTech(List<Map<String, Object>> projectsWithTech) {
        this.projectsWithTech = projectsWithTech;
    }

    public List<Map<String, Object>> getDecisionsByProject() {
        return decisionsByProject;
    }

    public void setDecisionsByProject(List<Map<String, Object>> decisionsByProject) {
        this.decisionsByProject = decisionsByProject;
    }

    public List<Map<String, Object>> getCrossSourceEntities() {
        return crossSourceEntities;
    }

    public void setCrossSourceEntities(List<Map<String, Object>> crossSourceEntities) {
        this.crossSourceEntities = crossSourceEntities;
    }

    public List<Map<String, Object>> getUnresolvedTasks() {
        return unresolvedTasks;
    }

    public void setUnresolvedTasks(List<Map<String, Object>> unresolvedTasks) {
        this.unresolvedTasks = unresolvedTasks;
    }

    public List<Map<String, Object>> getSupersededOrOutdated() {
        return supersededOrOutdated;
    }

    public void setSupersededOrOutdated(List<Map<String, Object>> supersededOrOutdated) {
        this.supersededOrOutdated = supersededOrOutdated;
    }

    public Map<String, Integer> getEvidenceDistribution() {
        return evidenceDistribution;
    }

    public void setEvidenceDistribution(Map<String, Integer> evidenceDistribution) {
        this.evidenceDistribution = evidenceDistribution;
    }

    public String getLastSyncTime() {
        return lastSyncTime;
    }

    public void setLastSyncTime(String lastSyncTime) {
        this.lastSyncTime = lastSyncTime;
    }
}
