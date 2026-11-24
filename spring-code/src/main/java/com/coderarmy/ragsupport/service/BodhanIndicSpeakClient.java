package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.hub.service.HubRegistryService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;

/**
 * Dedicated Client Adapter for Bodhan AI Indic-Speak (bodhan-ai/indic-speak).
 *
 * Connects to official api.bodhan.ai endpoints or custom Hugging Face Dedicated
 * Inference Endpoints.
 */
@Component
public class BodhanIndicSpeakClient {

    private static final Logger log = LoggerFactory.getLogger(BodhanIndicSpeakClient.class);

    public static final String MODEL_ID = "bodhan-ai/indic-speak";
    public static final String PROVIDER_NAME = "Bodhan Indic Speech Engine";

    @Value("${tts.bodhan.endpoint:}")
    private String endpoint = "";

    @Value("${tts.bodhan.api-key:}")
    private String apiKey = "";

    @Value("${tts.bodhan.timeout-seconds:25}")
    private int timeoutSeconds = 25;

    @Value("${tts.bodhan.enabled:true}")
    private boolean enabled = true;

    private final HubRegistryService hubRegistryService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient;

    public BodhanIndicSpeakClient() {
        this(null);
    }

    @Autowired
    public BodhanIndicSpeakClient(@Autowired(required = false) HubRegistryService hubRegistryService) {
        this(hubRegistryService, HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .connectTimeout(Duration.ofSeconds(15))
                .build());
    }

    public BodhanIndicSpeakClient(HubRegistryService hubRegistryService, HttpClient httpClient) {
        this.hubRegistryService = hubRegistryService;
        this.httpClient = httpClient;
    }

    public boolean isAvailable() {
        return enabled && endpoint != null && !endpoint.trim().isEmpty() && getEffectiveApiKey() != null;
    }

    public String getModelId() {
        return MODEL_ID;
    }

    public String getProviderName() {
        return PROVIDER_NAME;
    }

    public byte[] synthesize(String text, String languageCode) throws Exception {
        return synthesize(text, languageCode, null);
    }

    public byte[] synthesize(String text, String languageCode, String voice) throws Exception {
        if (!isAvailable()) {
            throw new IllegalStateException("Bodhan Indic-Speak endpoint or API key is not configured.");
        }
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Text cannot be empty for speech synthesis.");
        }

        String effectiveKey = getEffectiveApiKey();
        String targetEndpoint = endpoint.trim();
        String effectiveVoice = (voice != null && !voice.isBlank()) ? voice.trim() : languageCode;

        log.info("[Bodhan TTS] Invoking endpoint '{}' for lang='{}', voice='{}', chars={}",
                targetEndpoint, languageCode, effectiveVoice, text.length());

        HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                .uri(URI.create(targetEndpoint))
                .timeout(Duration.ofSeconds(timeoutSeconds));

        if (effectiveKey != null && !effectiveKey.isBlank()) {
            reqBuilder.header("Authorization", "Bearer " + effectiveKey);
        }

        if (targetEndpoint.contains("/v1/audio/speech") || targetEndpoint.contains("api.bodhan.ai")) {
            // OpenAI-compatible audio speech format
            Map<String, Object> payload = Map.of(
                    "model", MODEL_ID,
                    "input", text,
                    "voice", effectiveVoice,
                    "response_format", "mp3"
            );
            reqBuilder.header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload), StandardCharsets.UTF_8));
        } else {
            // Hugging Face Dedicated Inference Endpoint format
            Map<String, Object> payload = Map.of(
                    "inputs", text,
                    "parameters", Map.of("language", languageCode, "speaker", effectiveVoice)
            );
            reqBuilder.header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload), StandardCharsets.UTF_8));
        }

        HttpResponse<byte[]> response = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200 || response.body() == null || response.body().length == 0) {
            String err = response.body() != null ? new String(response.body(), StandardCharsets.UTF_8) : "Empty response";
            throw new IllegalStateException("Bodhan TTS endpoint returned HTTP " + response.statusCode() + ": " + err);
        }

        byte[] audioBytes = response.body();
        verifyAudioHeader(audioBytes);

        log.info("[Bodhan TTS] Synthesis SUCCESS: {} bytes for lang='{}'", audioBytes.length, languageCode);
        return audioBytes;
    }

    private void verifyAudioHeader(byte[] bytes) {
        if (bytes == null || bytes.length < 4) {
            throw new IllegalStateException("Received empty or truncated audio bytes.");
        }
        if (bytes[0] == '{') {
            String jsonErr = new String(bytes, StandardCharsets.UTF_8);
            throw new IllegalStateException("Received error response instead of audio: " + jsonErr);
        }
        if (bytes[0] == '<') {
            throw new IllegalStateException("Received HTML instead of audio binary from Bodhan endpoint.");
        }
        boolean isId3 = bytes[0] == 'I' && bytes[1] == 'D' && bytes[2] == '3';
        boolean isMp3Sync = (bytes[0] & 0xFF) == 0xFF && ((bytes[1] & 0xE0) == 0xE0);
        boolean isWav = bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F';

        if (!isId3 && !isMp3Sync && !isWav) {
            log.warn("[Bodhan TTS] Warning: Audio header magic bytes did not match standard MP3/WAV signatures: {}",
                    Arrays.toString(Arrays.copyOf(bytes, Math.min(bytes.length, 4))));
        }
    }

    public String getEffectiveApiKey() {
        if (apiKey != null && !apiKey.isBlank()) return apiKey.trim();
        String bodhanEnv = System.getenv("BODHAN_API_KEY");
        if (bodhanEnv != null && !bodhanEnv.isBlank()) return bodhanEnv.trim();
        if (hubRegistryService != null) {
            String token = hubRegistryService.getEffectiveHfToken();
            if (token != null && !token.isBlank()) return token;
        }
        String hfEnv = System.getenv("HF_TOKEN");
        if (hfEnv != null && !hfEnv.isBlank()) return hfEnv.trim();
        return null;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
