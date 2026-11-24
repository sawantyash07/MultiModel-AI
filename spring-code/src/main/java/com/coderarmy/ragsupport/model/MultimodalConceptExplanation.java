package com.coderarmy.ragsupport.model;

import java.util.List;
import java.util.Map;

public class MultimodalConceptExplanation {

    private String title;
    private String overview;
    private List<Map<String, String>> pipelineSteps;
    private Map<String, String> architectureComponents;
    private List<String> keyMathematicalFormulas;

    public MultimodalConceptExplanation() {
    }

    public MultimodalConceptExplanation(String title, String overview, List<Map<String, String>> pipelineSteps, Map<String, String> architectureComponents, List<String> keyMathematicalFormulas) {
        this.title = title;
        this.overview = overview;
        this.pipelineSteps = pipelineSteps;
        this.architectureComponents = architectureComponents;
        this.keyMathematicalFormulas = keyMathematicalFormulas;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getOverview() {
        return overview;
    }

    public void setOverview(String overview) {
        this.overview = overview;
    }

    public List<Map<String, String>> getPipelineSteps() {
        return pipelineSteps;
    }

    public void setPipelineSteps(List<Map<String, String>> pipelineSteps) {
        this.pipelineSteps = pipelineSteps;
    }

    public Map<String, String> getArchitectureComponents() {
        return architectureComponents;
    }

    public void setArchitectureComponents(Map<String, String> architectureComponents) {
        this.architectureComponents = architectureComponents;
    }

    public List<String> getKeyMathematicalFormulas() {
        return keyMathematicalFormulas;
    }

    public void setKeyMathematicalFormulas(List<String> keyMathematicalFormulas) {
        this.keyMathematicalFormulas = keyMathematicalFormulas;
    }
}
