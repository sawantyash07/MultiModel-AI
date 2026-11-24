package com.coderarmy.ragsupport.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Tracks multi-session project progress, architectural state, attempted solutions, and remaining tasks.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProjectContext {

    private String id;
    private String name;
    private String techStack;
    private String architecture;
    private List<String> keyFiles = new ArrayList<>();
    private List<String> attemptedSolutions = new ArrayList<>();
    private List<String> unresolvedTasks = new ArrayList<>();
    private List<String> completedTasks = new ArrayList<>();
    private String lastKnownState;
    private String updatedAt;

    public ProjectContext() {
        this.id = "proj-" + UUID.randomUUID().toString().substring(0, 8);
        this.updatedAt = Instant.now().toString();
    }

    public ProjectContext(String name, String techStack) {
        this();
        this.name = name;
        this.techStack = techStack;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getTechStack() {
        return techStack;
    }

    public void setTechStack(String techStack) {
        this.techStack = techStack;
    }

    public String getArchitecture() {
        return architecture;
    }

    public void setArchitecture(String architecture) {
        this.architecture = architecture;
    }

    public List<String> getKeyFiles() {
        return keyFiles;
    }

    public void setKeyFiles(List<String> keyFiles) {
        this.keyFiles = keyFiles;
    }

    public List<String> getAttemptedSolutions() {
        return attemptedSolutions;
    }

    public void setAttemptedSolutions(List<String> attemptedSolutions) {
        this.attemptedSolutions = attemptedSolutions;
    }

    public List<String> getUnresolvedTasks() {
        return unresolvedTasks;
    }

    public void setUnresolvedTasks(List<String> unresolvedTasks) {
        this.unresolvedTasks = unresolvedTasks;
    }

    public List<String> getCompletedTasks() {
        return completedTasks;
    }

    public void setCompletedTasks(List<String> completedTasks) {
        this.completedTasks = completedTasks;
    }

    public String getLastKnownState() {
        return lastKnownState;
    }

    public void setLastKnownState(String lastKnownState) {
        this.lastKnownState = lastKnownState;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
