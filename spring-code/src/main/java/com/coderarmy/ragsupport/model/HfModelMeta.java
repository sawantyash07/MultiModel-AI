package com.coderarmy.ragsupport.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class HfModelMeta {
    private String id;
    private String name;
    private String description;
    private String task;
    private String taskLabel;
    private List<String> providers;
    private long downloads;
    private long likes;
    private boolean isHosted;
    private boolean isVerified;
    private String hostingType;
    private String availabilityBadge;
    private String availabilityReason;
    private String useCase;
    private String status;
    private String candidateId;
    private List<String> inputModalities;
    private List<String> outputModalities;

    public HfModelMeta() {}

    public HfModelMeta(String id, String name, String description, String task, String taskLabel,
                       List<String> providers, long downloads, long likes, boolean isHosted,
                       boolean isVerified, String hostingType, String availabilityBadge,
                       String availabilityReason, List<String> inputModalities, List<String> outputModalities) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.task = task;
        this.taskLabel = taskLabel;
        this.providers = providers;
        this.downloads = downloads;
        this.likes = likes;
        this.isHosted = isHosted;
        this.isVerified = isVerified;
        this.hostingType = hostingType;
        this.availabilityBadge = availabilityBadge;
        this.availabilityReason = availabilityReason;
        this.inputModalities = inputModalities;
        this.outputModalities = outputModalities;
    }

    public HfModelMeta(String id, String name, String description, String task, String taskLabel,
                       String useCase, String status, String candidateId,
                       List<String> providers, long downloads, long likes, boolean isHosted,
                       boolean isVerified, String hostingType, String availabilityBadge,
                       String availabilityReason, List<String> inputModalities, List<String> outputModalities) {
        this(id, name, description, task, taskLabel, providers, downloads, likes, isHosted, isVerified, hostingType, availabilityBadge, availabilityReason, inputModalities, outputModalities);
        this.useCase = useCase;
        this.status = status;
        this.candidateId = candidateId;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getTask() { return task; }
    public void setTask(String task) { this.task = task; }

    public String getTaskLabel() { return taskLabel; }
    public void setTaskLabel(String taskLabel) { this.taskLabel = taskLabel; }

    public List<String> getProviders() { return providers; }
    public void setProviders(List<String> providers) { this.providers = providers; }

    public long getDownloads() { return downloads; }
    public void setDownloads(long downloads) { this.downloads = downloads; }

    public long getLikes() { return likes; }
    public void setLikes(long likes) { this.likes = likes; }

    @com.fasterxml.jackson.annotation.JsonProperty("isHosted")
    public boolean isHosted() { return isHosted; }
    public void setHosted(boolean hosted) { isHosted = hosted; }

    @com.fasterxml.jackson.annotation.JsonProperty("isVerified")
    public boolean isVerified() { return isVerified; }
    public void setVerified(boolean verified) { isVerified = verified; }

    public String getHostingType() { return hostingType; }
    public void setHostingType(String hostingType) { this.hostingType = hostingType; }

    public String getAvailabilityBadge() { return availabilityBadge; }
    public void setAvailabilityBadge(String availabilityBadge) { this.availabilityBadge = availabilityBadge; }

    public String getAvailabilityReason() { return availabilityReason; }
    public void setAvailabilityReason(String availabilityReason) { this.availabilityReason = availabilityReason; }

    public List<String> getInputModalities() { return inputModalities; }
    public void setInputModalities(List<String> inputModalities) { this.inputModalities = inputModalities; }

    public List<String> getOutputModalities() { return outputModalities; }
    public void setOutputModalities(List<String> outputModalities) { this.outputModalities = outputModalities; }

    public String getUseCase() { return useCase; }
    public void setUseCase(String useCase) { this.useCase = useCase; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCandidateId() { return candidateId; }
    public void setCandidateId(String candidateId) { this.candidateId = candidateId; }
}
