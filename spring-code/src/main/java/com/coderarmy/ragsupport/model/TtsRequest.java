package com.coderarmy.ragsupport.model;

/**
 * Request payload for Text-to-Speech synthesis in Yash AI.
 * Supports multilingual speech in English, Hindi, and Marathi.
 */
public class TtsRequest {

    private String text;
    private String language; // "en", "hi", "mr"
    private String voice;    // Optional speaker identifier / custom prompt
    private String conversationId;
    private String messageId;
    private Double speed;    // Optional playback speed: 0.5, 1.0, 1.5, 2.0

    public TtsRequest() {
    }

    public TtsRequest(String text, String language) {
        this.text = text;
        this.language = language;
    }

    public TtsRequest(String text, String language, String voice) {
        this.text = text;
        this.language = language;
        this.voice = voice;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getVoice() {
        return voice;
    }

    public void setVoice(String voice) {
        this.voice = voice;
    }

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public Double getSpeed() {
        return speed;
    }

    public void setSpeed(Double speed) {
        this.speed = speed;
    }
}
