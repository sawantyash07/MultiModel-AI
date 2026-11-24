package com.coderarmy.ragsupport.hub.model;

import java.util.ArrayList;
import java.util.List;

public class ImageGenerationRequest {
    private String modelId;
    private String prompt;
    private String negativePrompt;
    private int width = 1024;
    private int height = 1024;
    private String aspectRatio = "1:1";
    private Long seed;
    private Boolean enhancePrompt = false;
    private List<String> referenceImages = new ArrayList<>();
    private String referenceInstruction;
    private String editMode; // "generate", "edit", "variation", "refine"
    private String quality = "standard"; // "standard", "hd", "2k", "4k"
    private String style;
    private Boolean allowFallback = false;

    public ImageGenerationRequest() {}

    public String getModelId() {
        return modelId;
    }

    public void setModelId(String modelId) {
        this.modelId = modelId;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getNegativePrompt() {
        return negativePrompt;
    }

    public void setNegativePrompt(String negativePrompt) {
        this.negativePrompt = negativePrompt;
    }

    public int getWidth() {
        return width;
    }

    public void setWidth(int width) {
        this.width = width;
    }

    public int getHeight() {
        return height;
    }

    public void setHeight(int height) {
        this.height = height;
    }

    public String getAspectRatio() {
        return aspectRatio;
    }

    public void setAspectRatio(String aspectRatio) {
        this.aspectRatio = aspectRatio;
    }

    public Long getSeed() {
        return seed;
    }

    public void setSeed(Long seed) {
        this.seed = seed;
    }

    public Boolean getEnhancePrompt() {
        return enhancePrompt;
    }

    public void setEnhancePrompt(Boolean enhancePrompt) {
        this.enhancePrompt = enhancePrompt;
    }

    public List<String> getReferenceImages() {
        return referenceImages;
    }

    public void setReferenceImages(List<String> referenceImages) {
        this.referenceImages = referenceImages != null ? referenceImages : new ArrayList<>();
    }

    public String getReferenceInstruction() {
        return referenceInstruction;
    }

    public void setReferenceInstruction(String referenceInstruction) {
        this.referenceInstruction = referenceInstruction;
    }

    public String getEditMode() {
        return editMode;
    }

    public void setEditMode(String editMode) {
        this.editMode = editMode;
    }

    public String getQuality() {
        return quality;
    }

    public void setQuality(String quality) {
        this.quality = quality;
    }

    public String getStyle() {
        return style;
    }

    public void setStyle(String style) {
        this.style = style;
    }

    public Boolean getAllowFallback() {
        return allowFallback;
    }

    public void setAllowFallback(Boolean allowFallback) {
        this.allowFallback = allowFallback;
    }
}
