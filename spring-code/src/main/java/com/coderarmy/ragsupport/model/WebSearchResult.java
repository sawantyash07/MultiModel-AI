package com.coderarmy.ragsupport.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.net.URI;

/**
 * Represents an individual verified web search source and extracted evidence.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WebSearchResult {

    private int index;
    private String title;
    private String url;
    private String domain;
    private String snippet;
    private String publishedDate;
    private String sourceType; // OFFICIAL_DOCS, ACADEMIC, ENCYCLOPEDIA, NEWS, GENERAL
    private double credibilityScore;
    private boolean verified;

    public WebSearchResult() {
        this.verified = true;
        this.sourceType = "GENERAL";
        this.credibilityScore = 0.8;
    }

    public WebSearchResult(int index, String title, String url, String snippet, String sourceType) {
        this();
        this.index = index;
        this.title = title != null ? title.trim() : "";
        this.url = url != null ? url.trim() : "";
        this.snippet = snippet != null ? snippet.trim() : "";
        this.sourceType = sourceType != null ? sourceType : "GENERAL";
        this.domain = extractDomain(this.url);
        this.credibilityScore = calculateCredibility(this.domain, this.sourceType);
    }

    private String extractDomain(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) return "";
        try {
            URI uri = URI.create(rawUrl);
            String host = uri.getHost();
            if (host != null) {
                return host.startsWith("www.") ? host.substring(4) : host;
            }
        } catch (Exception ignored) {}
        return "";
    }

    private double calculateCredibility(String domain, String type) {
        if (domain.endsWith(".gov") || domain.endsWith(".mil")) return 1.0;
        if (domain.endsWith(".edu") || domain.contains("arxiv.org")) return 0.98;
        if (domain.contains("wikipedia.org")) return 0.95;
        if (domain.contains("github.com") || domain.contains("spring.io") || domain.contains("oracle.com") ||
            domain.contains("python.org") || domain.contains("mozilla.org") || domain.contains("microsoft.com") ||
            domain.contains("apache.org") || domain.contains("docker.com")) {
            return 0.95;
        }
        if ("OFFICIAL_DOCS".equalsIgnoreCase(type)) return 0.95;
        if ("ENCYCLOPEDIA".equalsIgnoreCase(type)) return 0.92;
        if ("NEWS".equalsIgnoreCase(type)) return 0.85;
        return 0.80;
    }

    public int getIndex() {
        return index;
    }

    public void setIndex(int index) {
        this.index = index;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
        this.domain = extractDomain(url);
    }

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public String getSnippet() {
        return snippet;
    }

    public void setSnippet(String snippet) {
        this.snippet = snippet;
    }

    public String getPublishedDate() {
        return publishedDate;
    }

    public void setPublishedDate(String publishedDate) {
        this.publishedDate = publishedDate;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public double getCredibilityScore() {
        return credibilityScore;
    }

    public void setCredibilityScore(double credibilityScore) {
        this.credibilityScore = credibilityScore;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }
}
