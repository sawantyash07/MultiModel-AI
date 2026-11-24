package com.coderarmy.ragsupport.model.kg;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.*;

/**
 * Structured persistent Knowledge Graph Node entity.
 * Represents a person, project, technical concept, technology, preference, decision, task, document, or conversation.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KnowledgeNode {

    private String id;
    private String type;         // PROJECT, TECHNOLOGY, CONCEPT, DECISION, TASK, PREFERENCE, PERSON, ORGANIZATION, GOAL, DOCUMENT, CONVERSATION
    private String label;        // Canonical display name (e.g. "React", "Spring Boot", "E-Commerce Dashboard")
    private String description;  // Contextual description or rationale
    private List<String> aliases = new ArrayList<>(); // Alternate surface forms, e.g. ["React.js", "ReactJS"]
    private String category;     // Matches type or broader grouping
    private String status;       // ACTIVE, COMPLETED, SUPERSEDED, UNRESOLVED, VERIFIED
    private double confidence = 1.0;
    private List<KnowledgeSourceRef> sources = new ArrayList<>();
    private Map<String, Object> properties = new LinkedHashMap<>();
    private String createdAt;
    private String updatedAt;

    public KnowledgeNode() {
        this.createdAt = Instant.now().toString();
        this.updatedAt = this.createdAt;
        this.status = "ACTIVE";
        this.confidence = 1.0;
    }

    public KnowledgeNode(String id, String type, String label, String description) {
        this();
        this.id = id;
        this.type = type != null ? type.toUpperCase().trim() : "CONCEPT";
        this.category = this.type;
        this.label = label != null ? label.trim() : "";
        this.description = description != null ? description.trim() : "";
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type != null ? type.toUpperCase().trim() : "CONCEPT";
        if (this.category == null) {
            this.category = this.type;
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

    public List<String> getAliases() {
        return aliases;
    }

    public void setAliases(List<String> aliases) {
        this.aliases = (aliases != null) ? new ArrayList<>(aliases) : new ArrayList<>();
    }

    public void addAlias(String alias) {
        if (alias == null || alias.isBlank()) return;
        String clean = alias.trim();
        if (!clean.equalsIgnoreCase(this.label) && !this.aliases.stream().anyMatch(a -> a.equalsIgnoreCase(clean))) {
            this.aliases.add(clean);
        }
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public double getConfidence() {
        return confidence;
    }

    public void setConfidence(double confidence) {
        this.confidence = confidence;
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

    public Map<String, Object> getProperties() {
        return properties;
    }

    public void setProperties(Map<String, Object> properties) {
        this.properties = (properties != null) ? new LinkedHashMap<>(properties) : new LinkedHashMap<>();
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
        KnowledgeNode that = (KnowledgeNode) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
