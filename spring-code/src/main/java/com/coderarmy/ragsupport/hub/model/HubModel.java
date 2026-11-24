package com.coderarmy.ragsupport.hub.model;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Universal metadata representation for an AI Model in the dedicated Model Hub.
 */
public class HubModel {

    private String id;
    private String name;
    private String taskType; // "text-to-text", "text-to-image", "image-to-text"
    private String taskLabel;
    private String provider;
    private String hfModelId;
    private String hfUrl;
    private String description;
    private List<String> capabilities = new ArrayList<>();
    private String accessRequirements;
    private String license;
    private String status; // "AVAILABLE", "ACCESS_REQUIRED", "PROVIDER_UNAVAILABLE", "CONFIGURATION_REQUIRED"
    private String statusDetail;
    private boolean verifiedWorking;
    private String lastVerifiedAt;
    private Long latencyMs;
    private Map<String, Object> parameters = new HashMap<>();

    public HubModel() {}

    public HubModel(
            String id,
            String name,
            String taskType,
            String taskLabel,
            String provider,
            String hfModelId,
            String hfUrl,
            String description,
            List<String> capabilities,
            String accessRequirements,
            String license,
            String status,
            String statusDetail,
            boolean verifiedWorking,
            Map<String, Object> parameters
    ) {
        this.id = id;
        this.name = name;
        this.taskType = taskType;
        this.taskLabel = taskLabel;
        this.provider = provider;
        this.hfModelId = hfModelId;
        this.hfUrl = hfUrl;
        this.description = description;
        this.capabilities = capabilities != null ? capabilities : new ArrayList<>();
        this.accessRequirements = accessRequirements;
        this.license = license;
        this.status = status;
        this.statusDetail = statusDetail;
        this.verifiedWorking = verifiedWorking;
        this.parameters = parameters != null ? parameters : new HashMap<>();
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

    public String getTaskType() {
        return taskType;
    }

    public void setTaskType(String taskType) {
        this.taskType = taskType;
    }

    public String getTaskLabel() {
        return taskLabel;
    }

    public void setTaskLabel(String taskLabel) {
        this.taskLabel = taskLabel;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getHfModelId() {
        return hfModelId;
    }

    public void setHfModelId(String hfModelId) {
        this.hfModelId = hfModelId;
    }

    public String getHfUrl() {
        return hfUrl;
    }

    public void setHfUrl(String hfUrl) {
        this.hfUrl = hfUrl;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<String> getCapabilities() {
        return capabilities;
    }

    public void setCapabilities(List<String> capabilities) {
        this.capabilities = capabilities;
    }

    public String getAccessRequirements() {
        return accessRequirements;
    }

    public void setAccessRequirements(String accessRequirements) {
        this.accessRequirements = accessRequirements;
    }

    public String getLicense() {
        return license;
    }

    public void setLicense(String license) {
        this.license = license;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getStatusDetail() {
        return statusDetail;
    }

    public void setStatusDetail(String statusDetail) {
        this.statusDetail = statusDetail;
    }

    public boolean isVerifiedWorking() {
        return verifiedWorking;
    }

    public void setVerifiedWorking(boolean verifiedWorking) {
        this.verifiedWorking = verifiedWorking;
    }

    public String getLastVerifiedAt() {
        return lastVerifiedAt;
    }

    public void setLastVerifiedAt(String lastVerifiedAt) {
        this.lastVerifiedAt = lastVerifiedAt;
    }

    public Long getLatencyMs() {
        return latencyMs;
    }

    public void setLatencyMs(Long latencyMs) {
        this.latencyMs = latencyMs;
    }

    public Map<String, Object> getParameters() {
        return parameters;
    }

    public void setParameters(Map<String, Object> parameters) {
        this.parameters = parameters;
    }
}
