package com.coderarmy.ragsupport.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;

/**
 * Result of the reliable research workflow containing verified evidence, citations,
 * entity verification status, and potential contradictions/limitations.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ResearchVerificationResult {

    private String query;
    private boolean neededSearch;
    private boolean searchPerformed;
    private boolean sourcesFound;
    private boolean entityVerified;
    private boolean disagreementDetected;
    private String disagreementNotes;
    private List<WebSearchResult> sources = new ArrayList<>();
    private String evidenceBrief;
    private String warningNotice;

    public ResearchVerificationResult() {
        this.entityVerified = true;
        this.sources = new ArrayList<>();
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public boolean isNeededSearch() {
        return neededSearch;
    }

    public void setNeededSearch(boolean neededSearch) {
        this.neededSearch = neededSearch;
    }

    public boolean isSearchPerformed() {
        return searchPerformed;
    }

    public void setSearchPerformed(boolean searchPerformed) {
        this.searchPerformed = searchPerformed;
    }

    public boolean isSourcesFound() {
        return sourcesFound;
    }

    public void setSourcesFound(boolean sourcesFound) {
        this.sourcesFound = sourcesFound;
    }

    public boolean isEntityVerified() {
        return entityVerified;
    }

    public void setEntityVerified(boolean entityVerified) {
        this.entityVerified = entityVerified;
    }

    public boolean isDisagreementDetected() {
        return disagreementDetected;
    }

    public void setDisagreementDetected(boolean disagreementDetected) {
        this.disagreementDetected = disagreementDetected;
    }

    public String getDisagreementNotes() {
        return disagreementNotes;
    }

    public void setDisagreementNotes(String disagreementNotes) {
        this.disagreementNotes = disagreementNotes;
    }

    public List<WebSearchResult> getSources() {
        return sources;
    }

    public void setSources(List<WebSearchResult> sources) {
        this.sources = sources;
    }

    public String getEvidenceBrief() {
        return evidenceBrief;
    }

    public void setEvidenceBrief(String evidenceBrief) {
        this.evidenceBrief = evidenceBrief;
    }

    public String getWarningNotice() {
        return warningNotice;
    }

    public void setWarningNotice(String warningNotice) {
        this.warningNotice = warningNotice;
    }
}
