package com.coderarmy.ragsupport.model.kg;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;

/**
 * Response payload for "Ask Your Knowledge Graph", grounded strictly in verified graph evidence.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KnowledgeAskResponse {

    private String answer;
    private List<KnowledgeNode> citedNodes = new ArrayList<>();
    private List<KnowledgeEdge> citedEdges = new ArrayList<>();
    private List<KnowledgeSourceRef> evidenceExcerpts = new ArrayList<>();
    private double confidence = 1.0;
    private boolean insufficientEvidence = false;
    private List<String> suggestedQueries = new ArrayList<>();

    public KnowledgeAskResponse() {}

    public KnowledgeAskResponse(String answer, boolean insufficientEvidence) {
        this.answer = answer;
        this.insufficientEvidence = insufficientEvidence;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public List<KnowledgeNode> getCitedNodes() {
        return citedNodes;
    }

    public void setCitedNodes(List<KnowledgeNode> citedNodes) {
        this.citedNodes = (citedNodes != null) ? citedNodes : new ArrayList<>();
    }

    public List<KnowledgeEdge> getCitedEdges() {
        return citedEdges;
    }

    public void setCitedEdges(List<KnowledgeEdge> citedEdges) {
        this.citedEdges = (citedEdges != null) ? citedEdges : new ArrayList<>();
    }

    public List<KnowledgeSourceRef> getEvidenceExcerpts() {
        return evidenceExcerpts;
    }

    public void setEvidenceExcerpts(List<KnowledgeSourceRef> evidenceExcerpts) {
        this.evidenceExcerpts = (evidenceExcerpts != null) ? evidenceExcerpts : new ArrayList<>();
    }

    public double getConfidence() {
        return confidence;
    }

    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }

    public boolean isInsufficientEvidence() {
        return insufficientEvidence;
    }

    public void setInsufficientEvidence(boolean insufficientEvidence) {
        this.insufficientEvidence = insufficientEvidence;
    }

    public List<String> getSuggestedQueries() {
        return suggestedQueries;
    }

    public void setSuggestedQueries(List<String> suggestedQueries) {
        this.suggestedQueries = (suggestedQueries != null) ? suggestedQueries : new ArrayList<>();
    }
}
