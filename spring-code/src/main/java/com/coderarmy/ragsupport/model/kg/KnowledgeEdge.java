package com.coderarmy.ragsupport.model.kg;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.*;

/**
 * Structured persistent Knowledge Graph Edge representing a directed relationship between two nodes.
 * Adheres to a controlled relationship vocabulary with provenance and verification status.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KnowledgeEdge {

    private String id;
    private String source;      // Source node ID
    private String target;      // Target node ID
    private String relation;    // WORKS_ON, USES_TECHNOLOGY, RELATED_TO, MENTIONS, DECIDED, DEPENDS_ON, HAS_TASK, SUPPORTS, CONTRADICTS, DERIVED_FROM, SUPERSEDES, SOLVES
    private String label;       // Human-readable relationship label
    private String description; // Explanation of connection
    private double confidence = 1.0;
    private boolean isInferred = false;
    private String status = "VERIFIED"; // VERIFIED, INFERRED, REJECTED
    private List<KnowledgeSourceRef> sources = new ArrayList<>();
    private String createdAt;
    private String updatedAt;

    public KnowledgeEdge() {
        this.createdAt = Instant.now().toString();
        this.updatedAt = this.createdAt;
        this.confidence = 1.0;
        this.status = "VERIFIED";
    }

    public KnowledgeEdge(String id, String source, String target, String relation, String label) {
        this();
        this.id = id;
        this.source = source;
        this.target = target;
        this.relation = relation != null ? relation.toUpperCase().trim() : "RELATED_TO";
        this.label = (label != null && !label.isBlank()) ? label.trim() : formatRelationLabel(this.relation);
    }

    public static String formatRelationLabel(String relation) {
        if (relation == null || relation.isBlank()) return "Related To";
        String[] parts = relation.toLowerCase().split("_");
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p.isEmpty()) continue;
            if (sb.length() > 0) sb.append(" ");
            sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
        }
        return sb.toString();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getTarget() {
        return target;
    }

    public void setTarget(String target) {
        this.target = target;
    }

    public String getRelation() {
        return relation;
    }

    public void setRelation(String relation) {
        this.relation = relation != null ? relation.toUpperCase().trim() : "RELATED_TO";
        if (this.label == null || this.label.isBlank()) {
            this.label = formatRelationLabel(this.relation);
        }
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public double getConfidence() {
        return confidence;
    }

    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }

    public boolean isInferred() {
        return isInferred;
    }

    public void setInferred(boolean inferred) {
        isInferred = inferred;
        if (inferred && "VERIFIED".equals(this.status)) {
            this.status = "INFERRED";
        }
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
        if ("INFERRED".equalsIgnoreCase(status)) {
            this.isInferred = true;
        } else if ("VERIFIED".equalsIgnoreCase(status)) {
            this.isInferred = false;
        }
    }

    public List<KnowledgeSourceRef> getSources() {
        return sources;
    }

    public void setSources(List<KnowledgeSourceRef> sources) {
        this.sources = (sources != null) ? new ArrayList<>(sources) : new ArrayList<>();
    }

    public void addSource(KnowledgeSourceRef source) {
        if (source == null) return;
        boolean exists = this.sources.stream().anyMatch(s -> s.equals(source));
        if (!exists) {
            this.sources.add(source);
        }
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        KnowledgeEdge that = (KnowledgeEdge) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
