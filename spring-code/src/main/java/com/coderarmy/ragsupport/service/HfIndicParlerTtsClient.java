package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.hub.service.HubRegistryService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Dedicated Hugging Face Text-to-Speech Client for AI4Bharat Indic-Parler-TTS
 * (ai4bharat/indic-parler-tts).
 *
 * Connects directly to the official Hugging Face Space running with ZeroGPU acceleration:
 * https://ai4bharat-indic-parler-tts.hf.space
 *
 * Implements the Gradio v5 SSE (Server-Sent Events) protocol:
 * 1. POST /gradio_api/call/generate_finetuned with [text, speakerDescription] -> returns event_id
 * 2. GET /gradio_api/call/generate_finetuned/{event_id} -> streams SSE events until 'complete'
 * 3. GET {audio_url} -> downloads high-fidelity MP3 audio binary.
 *
 * Supports all 22 Eighth Schedule Indian languages + English with verified speaker prompts.
 */
@Component
public class HfIndicParlerTtsClient {

    private static final Logger log = LoggerFactory.getLogger(HfIndicParlerTtsClient.class);

    public static final String MODEL_ID = "ai4bharat/indic-parler-tts";
    public static final String PROVIDER_NAME = "AI4Bharat IndicTTS (Hugging Face Space / ZeroGPU)";

    @Value("${tts.indic-parler.endpoint:https://ai4bharat-indic-parler-tts.hf.space}")
    private String endpoint = "https://ai4bharat-indic-parler-tts.hf.space";

    @Value("${tts.indic-parler.timeout-seconds:30}")
    private int timeoutSeconds = 30;

    @Value("${tts.indic-parler.enabled:true}")
    private boolean enabled = true;

    private final HubRegistryService hubRegistryService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient;

    public static class SpeakerProfile {
        private final String name;
        private final String prompt;

        public SpeakerProfile(String name, String prompt) {
            this.name = name;
            this.prompt = prompt;
        }

        public String getName() {
            return name;
        }

        public String getPrompt() {
            return prompt;
        }
    }

    private static final Map<String, SpeakerProfile> SPEAKER_PROFILES = new HashMap<>();

    static {
        // Female voices
        SpeakerProfile sunitaCalm = new SpeakerProfile("Sunita",
                "Sunita speaks slowly in a calm, moderate-pitched voice, delivering the news with a neutral tone. The recording is very high quality with no background noise.");
        SpeakerProfile aditiClear = new SpeakerProfile("Aditi",
                "Aditi speaks at a moderate pace and pitch, with a clear, neutral tone and no emotional emphasis. The recording is very high quality with no background noise.");
        SpeakerProfile jayaClear = new SpeakerProfile("Jaya",
                "Jaya speaks with a slightly low-pitched, quite monotone voice at a slightly faster-than-average pace in a confined space with very clear audio.");
        SpeakerProfile anjaliAnimated = new SpeakerProfile("Anjali",
                "Anjali speaks with a low-pitched voice delivering her words at a fast pace and an animated tone, in a very spacious environment, accompanied by noticeable background noise.");
        SpeakerProfile englishNatural = new SpeakerProfile("Natural",
                "A female speaker with a slightly low-pitched, quite monotone voice speaks with an American accent at a slightly faster-than-average pace in a confined space with very clear audio.");

        // Male voices
        SpeakerProfile rohitNarrative = new SpeakerProfile("Rohit",
                "Rohit speaks with a slightly high-pitched voice delivering his words at a slightly slow pace in a small, confined space with a touch of background noise and a quite monotone tone.");
        SpeakerProfile sureshCalm = new SpeakerProfile("Suresh",
                "Suresh speaks slowly in a low-pitched, calm voice, with a neutral tone, perfect for narration. The recording is very high quality with no background noise.");
        SpeakerProfile prakashCalm = new SpeakerProfile("Prakash",
                "Prakash speaks slowly in a low-pitched, calm voice, with a neutral tone, perfect for narration. The recording is very high quality with no background noise.");

        // Language to Speaker profile mappings
        SPEAKER_PROFILES.put("en", englishNatural);
        SPEAKER_PROFILES.put("hi", rohitNarrative);
        SPEAKER_PROFILES.put("mr", sunitaCalm);
        SPEAKER_PROFILES.put("bn", aditiClear);
        SPEAKER_PROFILES.put("ta", jayaClear);
        SPEAKER_PROFILES.put("te", prakashCalm);
        SPEAKER_PROFILES.put("kn", sureshCalm);
        SPEAKER_PROFILES.put("ml", anjaliAnimated);
        SPEAKER_PROFILES.put("gu", jayaClear);
        SPEAKER_PROFILES.put("pa", rohitNarrative);
        SPEAKER_PROFILES.put("ur", rohitNarrative);
        SPEAKER_PROFILES.put("ne", sunitaCalm);
        SPEAKER_PROFILES.put("or", aditiClear);
        SPEAKER_PROFILES.put("sa", sunitaCalm);
        SPEAKER_PROFILES.put("as", aditiClear);
        SPEAKER_PROFILES.put("ks", rohitNarrative);
        SPEAKER_PROFILES.put("sd", sunitaCalm);
        SPEAKER_PROFILES.put("kok", sunitaCalm);
        SPEAKER_PROFILES.put("mai", rohitNarrative);
        SPEAKER_PROFILES.put("doi", rohitNarrative);
        SPEAKER_PROFILES.put("brx", rohitNarrative);
        SPEAKER_PROFILES.put("mni", aditiClear);
        SPEAKER_PROFILES.put("sat", aditiClear);
    }

    public HfIndicParlerTtsClient() {
        this(null);
    }

    @Autowired
    public HfIndicParlerTtsClient(@Autowired(required = false) HubRegistryService hubRegistryService) {
        this(hubRegistryService, HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .connectTimeout(Duration.ofSeconds(15))
                .build());
    }

    public HfIndicParlerTtsClient(HubRegistryService hubRegistryService, HttpClient httpClient) {
        this.hubRegistryService = hubRegistryService;
        this.httpClient = httpClient;
    }

    public boolean isAvailable() {
        return enabled && endpoint != null && !endpoint.isBlank();
    }

    public String getModelId() {
        return MODEL_ID;
    }

    public String getProviderName() {
        return PROVIDER_NAME;
    }

    public SpeakerProfile getSpeakerForLanguage(String languageCode) {
        if (languageCode == null) return SPEAKER_PROFILES.get("en");
        String norm = languageCode.trim().toLowerCase();
        return SPEAKER_PROFILES.getOrDefault(norm, SPEAKER_PROFILES.get("hi"));
    }

    /**
     * Synthesizes audio using ai4bharat/indic-parler-tts hosted Gradio v5 Space.
     *
     * @param text Spoken text formatted for the target language.
     * @param languageCode ISO language code.
     * @return Binary MP3 audio bytes.
     * @throws Exception If generation fails, times out, or returns invalid audio.
     */
    public byte[] synthesize(String text, String languageCode) throws Exception {
        if (!isAvailable()) {
            throw new IllegalStateException("HfIndicParlerTtsClient is not enabled or endpoint is not configured.");
        }
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Text cannot be empty for speech synthesis.");
        }

        SpeakerProfile speaker = getSpeakerForLanguage(languageCode);
        String token = getEffectiveHfToken();

        String baseEndpoint = endpoint.replaceAll("/+$", "");
        String callUrl = baseEndpoint + "/gradio_api/call/generate_finetuned";

        log.info("[HF Indic-Parler-TTS] Initiating synthesis for lang='{}', speaker='{}', chars={}",
                languageCode, speaker.getName(), text.length());

        // 1. Submit job via POST /gradio_api/call/generate_finetuned
        Map<String, Object> reqPayload = Map.of(
                "data", List.of(text, speaker.getPrompt())
        );
        String reqJson = objectMapper.writeValueAsString(reqPayload);

        HttpRequest.Builder callBuilder = HttpRequest.newBuilder()
                .uri(URI.create(callUrl))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .POST(HttpRequest.BodyPublishers.ofString(reqJson, StandardCharsets.UTF_8));

        if (token != null && !token.isBlank()) {
            callBuilder.header("Authorization", "Bearer " + token);
        }

        HttpResponse<String> callResponse = httpClient.send(callBuilder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (callResponse.statusCode() != 200) {
            throw new IllegalStateException("Hugging Face Space returned HTTP " + callResponse.statusCode() + ": " + callResponse.body());
        }

        JsonNode callNode = objectMapper.readTree(callResponse.body());
        String eventId = callNode.path("event_id").asText(null);
        if (eventId == null || eventId.isBlank()) {
            throw new IllegalStateException("Hugging Face Space did not return an event_id in response: " + callResponse.body());
        }

        // 2. Listen to SSE stream via GET /gradio_api/call/generate_finetuned/{event_id}
        String streamUrl = baseEndpoint + "/gradio_api/call/generate_finetuned/" + eventId;
        HttpRequest.Builder streamBuilder = HttpRequest.newBuilder()
                .uri(URI.create(streamUrl))
                .header("Accept", "text/event-stream")
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .GET();

        if (token != null && !token.isBlank()) {
            streamBuilder.header("Authorization", "Bearer " + token);
        }

        HttpResponse<InputStream> streamResponse = httpClient.send(streamBuilder.build(), HttpResponse.BodyHandlers.ofInputStream());
        if (streamResponse.statusCode() != 200) {
            throw new IllegalStateException("Hugging Face Space SSE stream returned HTTP " + streamResponse.statusCode());
        }

        String audioDownloadUrl = extractAudioUrlFromSseStream(streamResponse.body(), baseEndpoint);
        if (audioDownloadUrl == null || audioDownloadUrl.isBlank()) {
            throw new IllegalStateException("Hugging Face Space did not produce an audio output URL for event_id=" + eventId);
        }

        // 3. Download audio binary
        log.info("[HF Indic-Parler-TTS] Downloading audio from '{}'", audioDownloadUrl);
        HttpRequest.Builder audioBuilder = HttpRequest.newBuilder()
                .uri(URI.create(audioDownloadUrl))
                .header("Accept", "audio/mpeg, audio/*; q=0.9, */*; q=0.5")
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .GET();

        if (token != null && !token.isBlank()) {
            audioBuilder.header("Authorization", "Bearer " + token);
        }

        HttpResponse<byte[]> audioResponse = httpClient.send(audioBuilder.build(), HttpResponse.BodyHandlers.ofByteArray());
        if (audioResponse.statusCode() != 200 || audioResponse.body() == null || audioResponse.body().length == 0) {
            throw new IllegalStateException("Failed to download audio binary from Space: HTTP " + audioResponse.statusCode());
        }

        byte[] audioBytes = audioResponse.body();
        verifyAudioHeader(audioBytes);

        log.info("[HF Indic-Parler-TTS] Synthesis SUCCESS: {} bytes for lang='{}' (speaker='{}')",
                audioBytes.length, languageCode, speaker.getName());

        return audioBytes;
    }

    /**
     * Reads lines from the SSE stream and resolves the final audio download URL.
     */
    public String extractAudioUrlFromSseStream(InputStream inputStream, String baseEndpoint) throws Exception {
        String lastUrl = null;
        String lastPath = null;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            String currentEvent = null;

            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;

                if (line.startsWith("event:")) {
                    currentEvent = line.substring(6).trim();
                    if ("error".equalsIgnoreCase(currentEvent)) {
                        String errorData = reader.readLine();
                        throw new IllegalStateException("Hugging Face Space generation error: " + errorData);
                    }
                } else if (line.startsWith("data:")) {
                    String dataJson = line.substring(5).trim();
                    if ("null".equals(dataJson) || dataJson.isEmpty()) continue;

                    try {
                        JsonNode root = objectMapper.readTree(dataJson);
                        if (root.isArray() && root.size() > 0) {
                            JsonNode item = root.get(0);
                            if (item.has("url")) {
                                lastUrl = item.path("url").asText(null);
                            }
                            if (item.has("path")) {
                                lastPath = item.path("path").asText(null);
                            }
                        } else if (root.isObject()) {
                            if (root.has("url")) {
                                lastUrl = root.path("url").asText(null);
                            }
                            if (root.has("path")) {
                                lastPath = root.path("path").asText(null);
                            }
                        }
                    } catch (Exception e) {
                        // Regex fallback
                        Matcher urlMatcher = Pattern.compile("\"url\":\\s*\"([^\"]+)\"").matcher(dataJson);
                        if (urlMatcher.find()) {
                            lastUrl = urlMatcher.group(1);
                        }
                    }

                    if ("complete".equalsIgnoreCase(currentEvent) && (lastUrl != null || lastPath != null)) {
                        break;
                    }
                }
            }
        }

        // Normalize URL if present
        if (lastUrl != null && !lastUrl.isBlank()) {
            // Fix Gradio v5 duplicate path quirk: /gradio_api/c/gradio_api/ -> /gradio_api/
            String normalized = lastUrl.replace("/gradio_api/c/gradio_api/", "/gradio_api/");
            if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
                if (!normalized.startsWith("/")) normalized = "/" + normalized;
                normalized = baseEndpoint + normalized;
            }
            return normalized;
        }

        // Fallback to path if url was missing
        if (lastPath != null && !lastPath.isBlank()) {
            return baseEndpoint + "/gradio_api/file=" + lastPath;
        }

        return null;
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
            throw new IllegalStateException("Received HTML instead of audio binary from upstream service.");
        }
        boolean isId3 = bytes[0] == 'I' && bytes[1] == 'D' && bytes[2] == '3';
        boolean isMp3Sync = (bytes[0] & 0xFF) == 0xFF && ((bytes[1] & 0xE0) == 0xE0);
        boolean isWav = bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F';

        if (!isId3 && !isMp3Sync && !isWav) {
            log.warn("[HF Indic-Parler-TTS] Warning: Audio header magic bytes did not match standard MP3/WAV signatures: {}",
                    Arrays.toString(Arrays.copyOf(bytes, Math.min(bytes.length, 4))));
        }
    }

    private String getEffectiveHfToken() {
        if (hubRegistryService != null) {
            String token = hubRegistryService.getEffectiveHfToken();
            if (token != null && !token.isBlank()) return token;
        }
        String env = System.getenv("HF_TOKEN");
        if (env != null && !env.isBlank()) return env.trim();
        return null;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
