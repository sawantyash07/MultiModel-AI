package com.coderarmy.ragsupport.model.registry;

import java.util.*;

/**
 * Detailed Model Metadata Database entity for Yash AI Multimodal Platform.
 * Contains verified free-tier conditions, rate limits, quota reset periods,
 * context windows, input/output modalities, and official documentation URLs.
 */
public class ModelMetadata {

    private String id;
    private String name;
    private String provider;              // "Google Gemini", "Groq LPU Cloud", "Local Ollama", "Hugging Face", "OpenRouter", "Pollinations", "Cohere", "Sarvam AI"
    private String providerId;            // "gemini", "groq", "ollama", "huggingface", "openrouter", "pollinations", "cohere", "sarvam", "google-hosted"
    private String modelIdentifier;       // Exact upstream model ID used in API calls
    private List<String> categories = new ArrayList<>();
    private List<String> supportedInputModalities = new ArrayList<>();   // text, image, audio, video
    private List<String> supportedOutputModalities = new ArrayList<>();  // text, image, audio, video, embedding
    private String freeAccessType;        // "Free Tier API", "Free Hosted Inference", "Local Open Weights", "Serverless Free Tier", "Free Trial Key"
    private String verifiedQuota;         // Exact allowance (e.g. "15 RPM / 1M TPM / 1,500 RPD", "30 RPM / 1,000 RPD", "Unlimited Offline")
    private String resetPeriod;           // "Daily (Midnight PT)", "Monthly", "Per Minute", "Unlimited / Local"
    private Map<String, Object> rateLimits = new LinkedHashMap<>();       // rpm, rpd, tpm, tpd, rps
    private String costAfterFree;         // Cost after exceeding free quota or "Free Only"
    private Integer contextWindow;        // Total context window in tokens
    private Integer maxOutputTokens;      // Maximum output token generation limit
    private Long latencyMs;               // Average latency in ms (estimated or measured)
    private Boolean streamingSupport;     // Whether token/chunk-based streaming is supported
    private List<String> languageSupport = new ArrayList<>(); // Supported natural languages
    private Map<String, Object> constraints = new LinkedHashMap<>();     // Modality constraints (max image size, video length, etc.)
    private String officialModelUrl;      // Official model card / Hugging Face model page
    private String apiDocUrl;             // Official API reference / documentation
    private String license;               // Apache-2.0, MIT, Llama 3.3 Community, Google Terms, OpenRAIL
    private List<String> requiredEnvVars = new ArrayList<>(); // Required environment variables to activate
    private String availabilityStatus;    // "AVAILABLE", "READY", "UNCONFIGURED", "DEGRADED", "OFFLINE"
    private String statusDetail;          // Human-readable status explanation
    private Boolean isRecommended;        // Strongest recommendation in its category
    private Integer rankingScore;         // 1-100 composite quality & utility score
    private Boolean isFreeOnlyEligible;   // True if guaranteed zero-cost or strictly within free-tier
    private String verifiedDate;          // Date of verification (e.g. "Verified Oct 2026")
    private String description;           // Concise description of capabilities and best use cases

    public ModelMetadata() {}

    // Builder-style setters & standard getters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getProviderId() { return providerId; }
    public void setProviderId(String providerId) { this.providerId = providerId; }

    public String getModelIdentifier() { return modelIdentifier; }
    public void setModelIdentifier(String modelIdentifier) { this.modelIdentifier = modelIdentifier; }

    public List<String> getCategories() { return categories; }
    public void setCategories(List<String> categories) { this.categories = categories; }

    public List<String> getSupportedInputModalities() { return supportedInputModalities; }
    public void setSupportedInputModalities(List<String> supportedInputModalities) { this.supportedInputModalities = supportedInputModalities; }

    public List<String> getSupportedOutputModalities() { return supportedOutputModalities; }
    public void setSupportedOutputModalities(List<String> supportedOutputModalities) { this.supportedOutputModalities = supportedOutputModalities; }

    public String getFreeAccessType() { return freeAccessType; }
    public void setFreeAccessType(String freeAccessType) { this.freeAccessType = freeAccessType; }

    public String getVerifiedQuota() { return verifiedQuota; }
    public void setVerifiedQuota(String verifiedQuota) { this.verifiedQuota = verifiedQuota; }

    public String getResetPeriod() { return resetPeriod; }
    public void setResetPeriod(String resetPeriod) { this.resetPeriod = resetPeriod; }

    public Map<String, Object> getRateLimits() { return rateLimits; }
    public void setRateLimits(Map<String, Object> rateLimits) { this.rateLimits = rateLimits; }

    public String getCostAfterFree() { return costAfterFree; }
    public void setCostAfterFree(String costAfterFree) { this.costAfterFree = costAfterFree; }

    public Integer getContextWindow() { return contextWindow; }
    public void setContextWindow(Integer contextWindow) { this.contextWindow = contextWindow; }

    public Integer getMaxOutputTokens() { return maxOutputTokens; }
    public void setMaxOutputTokens(Integer maxOutputTokens) { this.maxOutputTokens = maxOutputTokens; }

    public Long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(Long latencyMs) { this.latencyMs = latencyMs; }

    public Boolean getStreamingSupport() { return streamingSupport; }
    public void setStreamingSupport(Boolean streamingSupport) { this.streamingSupport = streamingSupport; }

    public List<String> getLanguageSupport() { return languageSupport; }
    public void setLanguageSupport(List<String> languageSupport) { this.languageSupport = languageSupport; }

    public Map<String, Object> getConstraints() { return constraints; }
    public void setConstraints(Map<String, Object> constraints) { this.constraints = constraints; }

    public String getOfficialModelUrl() { return officialModelUrl; }
    public void setOfficialModelUrl(String officialModelUrl) { this.officialModelUrl = officialModelUrl; }

    public String getApiDocUrl() { return apiDocUrl; }
    public void setApiDocUrl(String apiDocUrl) { this.apiDocUrl = apiDocUrl; }

    public String getLicense() { return license; }
    public void setLicense(String license) { this.license = license; }

    public List<String> getRequiredEnvVars() { return requiredEnvVars; }
    public void setRequiredEnvVars(List<String> requiredEnvVars) { this.requiredEnvVars = requiredEnvVars; }

    public String getAvailabilityStatus() { return availabilityStatus; }
    public void setAvailabilityStatus(String availabilityStatus) { this.availabilityStatus = availabilityStatus; }

    public String getStatusDetail() { return statusDetail; }
    public void setStatusDetail(String statusDetail) { this.statusDetail = statusDetail; }

    public Boolean getIsRecommended() { return isRecommended; }
    public void setIsRecommended(Boolean isRecommended) { this.isRecommended = isRecommended; }

    public Integer getRankingScore() { return rankingScore; }
    public void setRankingScore(Integer rankingScore) { this.rankingScore = rankingScore; }

    public Boolean getIsFreeOnlyEligible() { return isFreeOnlyEligible; }
    public void setIsFreeOnlyEligible(Boolean isFreeOnlyEligible) { this.isFreeOnlyEligible = isFreeOnlyEligible; }

    public String getVerifiedDate() { return verifiedDate; }
    public void setVerifiedDate(String verifiedDate) { this.verifiedDate = verifiedDate; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
