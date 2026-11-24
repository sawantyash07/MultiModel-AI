package com.coderarmy.ragsupport.model.kg;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * Request payload for "Ask Your Knowledge Graph".
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KnowledgeAskRequest {

    private String question;
    private String focusNodeId;
    private String modelId;
    private Map<String, Object> filters;

    public KnowledgeAskRequest() {}

    public KnowledgeAskRequest(String question) {
        this.question = question;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getFocusNodeId() {
        return focusNodeId;
    }

    public void setFocusNodeId(String focusNodeId) {
        this.focusNodeId = focusNodeId;
    }

    public String getModelId() {
        return modelId;
    }

    public void setModelId(String modelId) {
        this.modelId = modelId;
    }

    public Map<String, Object> getFilters() {
        return filters;
    }

    public void setFilters(Map<String, Object> filters) {
        this.filters = filters;
    }
}
