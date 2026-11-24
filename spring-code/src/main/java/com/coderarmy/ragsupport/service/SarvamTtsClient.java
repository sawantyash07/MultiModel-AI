package com.coderarmy.ragsupport.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * Dedicated Client Adapter for Sarvam AI Bulbul Neural Text-To-Speech.
 *
 * Supports Bulbul v4 Flash (bulbul:v4-flash) and Bulbul v3 (bulbul:v3)
 * for 11 Indian languages with low latency and authentic prosody.
 */
@Component
public class SarvamTtsClient {

    private static final Logger log = LoggerFactory.getLogger(SarvamTtsClient.class);

    public static final String PROVIDER_NAME = "Sarvam AI Bulbul (v4-flash / v3)";
    public static final String DEFAULT_MODEL = "bulbul:v4-flash";
    private static final int MAX_CHARS = 2500;

    // Supported Sarvam language code mappings
    private static final Map<String, String> LANGUAGE_CODE_MAP = new HashMap<>();
    static {
        LANGUAGE_CODE_MAP.put("en", "en-IN");
        LANGUAGE_CODE_MAP.put("hi", "hi-IN");
        LANGUAGE_CODE_MAP.put("bn", "bn-IN");
        LANGUAGE_CODE_MAP.put("ta", "ta-IN");
        LANGUAGE_CODE_MAP.put("te", "te-IN");
        LANGUAGE_CODE_MAP.put("kn", "kn-IN");
        LANGUAGE_CODE_MAP.put("ml", "ml-IN");
        LANGUAGE_CODE_MAP.put("mr", "mr-IN");
        LANGUAGE_CODE_MAP.put("gu", "gu-IN");
        LANGUAGE_CODE_MAP.put("pa", "pa-IN");
        LANGUAGE_CODE_MAP.put("or", "or-IN");
    }

    // Default speaker mapping per language
    private static final Map<String, String> DEFAULT_SPEAKERS = new HashMap<>();
    static {
        DEFAULT_SPEAKERS.put("en", "shubh");
        DEFAULT_SPEAKERS.put("hi", "shubh");
        DEFAULT_SPEAKERS.put("bn", "aditi");
        DEFAULT_SPEAKERS.put("ta", "shubh");
        DEFAULT_SPEAKERS.put("te", "shubh");
        DEFAULT_SPEAKERS.put("kn", "shubh");
        DEFAULT_SPEAKERS.put("ml", "shubh");
        DEFAULT_SPEAKERS.put("mr", "shubh");
        DEFAULT_SPEAKERS.put("gu", "shubh");
        DEFAULT_SPEAKERS.put("pa", "shubh");
        DEFAULT_SPEAKERS.put("or", "aditi");
    }

    @Value("${sarvam.api-key:}")
    private String apiKey = "";

    @Value("${sarvam.endpoint:https://api.sarvam.ai/text-to-speech}")
    private String endpoint = "https://api.sarvam.ai/text-to-speech";

    @Value("${sarvam.model-id:bulbul:v4-flash}")
    private String modelId = DEFAULT_MODEL;

    @Value("${sarvam.default-speaker:shubh}")
    private String defaultSpeaker = "shubh";

    @Value("${sarvam.enabled:true}")
    private boolean enabled = true;

    @Value("${sarvam.timeout-seconds:25}")
    private int timeoutSeconds = 25;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient;

    public SarvamTtsClient() {
        this(HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .connectTimeout(Duration.ofSeconds(15))
                .build());
    }

    public SarvamTtsClient(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    public boolean isConfigured() {
        return enabled && getEffectiveApiKey() != null && !getEffectiveApiKey().isBlank();
    }

    public boolean supportsLanguage(String langCode) {
        if (langCode == null) return false;
        return LANGUAGE_CODE_MAP.containsKey(langCode.trim().toLowerCase());
    }

    public String getEffectiveApiKey() {
        if (apiKey != null && !apiKey.isBlank()) return apiKey.trim();
        String env = System.getenv("SARVAM_API_KEY");
        if (env != null && !env.isBlank()) return env.trim();
        return null;
    }

    public String getModelId() {
        return modelId != null && !modelId.isBlank() ? modelId : DEFAULT_MODEL;
    }

    public String getProviderName() {
        return PROVIDER_NAME;
    }

    /**
     * Synthesizes speech via Sarvam AI Bulbul TTS API.
     *
     * @param text Normalized text.
     * @param languageCode Canonical language code (e.g. "hi", "mr", "ta").
     * @param voice Voice identifier (e.g. "shubh", "aditya", "ritu", "priya").
     * @param speed Playback speed multiplier (0.5 to 2.0).
     * @return Decoded MP3 audio bytes.
     * @throws Exception on API failure or HTTP error.
     */
    public byte[] synthesize(String text, String languageCode, String voice, Double speed) throws Exception {
        if (!isConfigured()) {
            throw new IllegalStateException("Sarvam AI API key is not configured.");
        }
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Text cannot be empty for speech synthesis.");
        }

        String normLang = languageCode != null ? languageCode.trim().toLowerCase() : "en";
        String sarvamLangCode = LANGUAGE_CODE_MAP.get(normLang);
        if (sarvamLangCode == null) {
            throw new UnsupportedOperationException("Sarvam Bulbul does not support language: " + normLang);
        }

        // Resolve speaker voice
        String speaker = (voice != null && !voice.isBlank())
                ? voice.trim().toLowerCase()
                : DEFAULT_SPEAKERS.getOrDefault(normLang, defaultSpeaker);

        double pace = (speed != null && speed >= 0.5 && speed <= 2.0) ? speed : 1.0;

        // Truncate safely if text exceeds maximum character boundary
        String safeText = text.trim();
        if (safeText.length() > MAX_CHARS) {
            safeText = safeText.substring(0, MAX_CHARS).trim();
        }

        log.info("[Sarvam TTS] Invoking endpoint for lang='{}', speaker='{}', pace={}, chars={}",
                sarvamLangCode, speaker, pace, safeText.length());

        Map<String, Object> reqPayload = new LinkedHashMap<>();
        reqPayload.put("text", safeText);
        reqPayload.put("language_code", sarvamLangCode);
        reqPayload.put("model", getModelId());
        reqPayload.put("speaker", speaker);
        reqPayload.put("pace", pace);
        reqPayload.put("speech_sample_rate", 24000);
        reqPayload.put("audio_codec", "mp3");

        String reqJson = objectMapper.writeValueAsString(reqPayload);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint.trim()))
                .header("api-subscription-key", getEffectiveApiKey())
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .POST(HttpRequest.BodyPublishers.ofString(reqJson, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

        if (response.statusCode() != 200) {
            log.error("[Sarvam TTS] API returned HTTP {}: {}", response.statusCode(), response.body());
            if (response.statusCode() == 401 || response.statusCode() == 403) {
                throw new IllegalStateException("Sarvam AI Authentication Failed (HTTP " + response.statusCode() + "). Check SARVAM_API_KEY.");
            } else if (response.statusCode() == 429) {
                throw new IllegalStateException("Sarvam AI Rate Limit Exceeded (HTTP 429). Please wait before requesting audio.");
            }
            throw new IllegalStateException("Sarvam AI TTS Error (HTTP " + response.statusCode() + "): " + response.body());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode audiosNode = root.path("audios");
        if (!audiosNode.isArray() || audiosNode.isEmpty()) {
            throw new IllegalStateException("Sarvam AI returned empty audio array: " + response.body());
        }

        String base64Audio = audiosNode.get(0).asText();
        if (base64Audio == null || base64Audio.isBlank()) {
            throw new IllegalStateException("Sarvam AI returned empty base64 audio payload.");
        }

        byte[] audioBytes = Base64.getDecoder().decode(base64Audio);
        log.info("[Sarvam TTS] Synthesis SUCCESS: {} bytes (model='{}', speaker='{}')",
                audioBytes.length, getModelId(), speaker);

        return audioBytes;
    }
}
