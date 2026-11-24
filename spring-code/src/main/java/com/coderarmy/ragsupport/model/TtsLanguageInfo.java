package com.coderarmy.ragsupport.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Metadata descriptor for supported Text-to-Speech languages and their verified voices.
 */
public class TtsLanguageInfo {

    public static class VoiceOption {
        private String id;
        private String name;
        private String gender; // "Male" | "Female"
        private String style;  // e.g. "Confident & Natural", "Calm Narration"
        private boolean isDefault;
        private String provider; // "sarvam", "google-hosted", "bodhan", "ai4bharat"

        public VoiceOption() {}

        public VoiceOption(String id, String name, String gender, String style, boolean isDefault, String provider) {
            this.id = id;
            this.name = name;
            this.gender = gender;
            this.style = style;
            this.isDefault = isDefault;
            this.provider = provider;
        }

        public VoiceOption(String id, String name, String gender, String style, boolean isDefault) {
            this(id, name, gender, style, isDefault, "auto");
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getGender() { return gender; }
        public void setGender(String gender) { this.gender = gender; }

        public String getStyle() { return style; }
        public void setStyle(String style) { this.style = style; }

        public boolean isDefault() { return isDefault; }
        public void setDefault(boolean aDefault) { isDefault = aDefault; }

        public String getProvider() { return provider; }
        public void setProvider(String provider) { this.provider = provider; }
    }

    private String code;
    private String name;
    private String nativeName;
    private String defaultSpeaker;
    private String speakerDescription;
    private String script;
    private String status = "production"; // "production" | "preview" | "experimental" | "unavailable"
    private String provider = "Google Hosted Multilingual Speech Engine";
    private String modelId = "google/multilingual-tts";
    private boolean nativeLlmSupported = true;
    private boolean streamingSupported = true;
    private String fallbackProvider = "Google Hosted Multilingual Speech Engine";
    private int maxCharacters = 2500;
    private List<String> availableProviders = new ArrayList<>();
    private List<VoiceOption> voices = new ArrayList<>();

    public TtsLanguageInfo() {}

    public TtsLanguageInfo(String code, String name, String nativeName, String defaultSpeaker, String speakerDescription) {
        this.code = code;
        this.name = name;
        this.nativeName = nativeName;
        this.defaultSpeaker = defaultSpeaker;
        this.speakerDescription = speakerDescription;
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getNativeName() { return nativeName; }
    public void setNativeName(String nativeName) { this.nativeName = nativeName; }

    public String getDefaultSpeaker() { return defaultSpeaker; }
    public void setDefaultSpeaker(String defaultSpeaker) { this.defaultSpeaker = defaultSpeaker; }

    public String getSpeakerDescription() { return speakerDescription; }
    public void setSpeakerDescription(String speakerDescription) { this.speakerDescription = speakerDescription; }

    public String getScript() { return script; }
    public void setScript(String script) { this.script = script; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getModelId() { return modelId; }
    public void setModelId(String modelId) { this.modelId = modelId; }

    public boolean isNativeLlmSupported() { return nativeLlmSupported; }
    public void setNativeLlmSupported(boolean nativeLlmSupported) { this.nativeLlmSupported = nativeLlmSupported; }

    public boolean isStreamingSupported() { return streamingSupported; }
    public void setStreamingSupported(boolean streamingSupported) { this.streamingSupported = streamingSupported; }

    public String getFallbackProvider() { return fallbackProvider; }
    public void setFallbackProvider(String fallbackProvider) { this.fallbackProvider = fallbackProvider; }

    public int getMaxCharacters() { return maxCharacters; }
    public void setMaxCharacters(int maxCharacters) { this.maxCharacters = maxCharacters; }

    public List<String> getAvailableProviders() { return availableProviders; }
    public void setAvailableProviders(List<String> availableProviders) { this.availableProviders = availableProviders; }

    public List<VoiceOption> getVoices() { return voices; }
    public void setVoices(List<VoiceOption> voices) { this.voices = voices; }

    public void addVoice(VoiceOption voice) {
        if (this.voices == null) this.voices = new ArrayList<>();
        this.voices.add(voice);
    }
}
