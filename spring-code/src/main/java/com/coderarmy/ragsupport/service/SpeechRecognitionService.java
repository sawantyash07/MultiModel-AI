package com.coderarmy.ragsupport.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * Enterprise Speech-to-Text (ASR) Service.
 * Transcribes English, Hindi, and Marathi audio using OpenAI Whisper Large v3.
 * Primary: Hugging Face hosted router endpoint (openai/whisper-large-v3).
 * Fallback: Groq high-speed hosted whisper-large-v3 for zero-quota interruptions.
 */
@Service
public class SpeechRecognitionService {

    private static final Logger log = LoggerFactory.getLogger(SpeechRecognitionService.class);

    public static final String MODEL_ID = "openai/whisper-large-v3";

    @Value("${huggingface.token:}")
    private String hfToken;

    @Value("${groq.api-key:}")
    private String groqApiKey;

    @Value("${asr.hf-endpoint:https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3}")
    private String hfEndpoint;

    @Value("${asr.timeout-seconds:30}")
    private int timeoutSeconds;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.ALWAYS)
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public Map<String, Object> transcribe(MultipartFile file, String languageHint) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No audio file provided for transcription.");
        }

        byte[] audioBytes = file.getBytes();
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "audio.webm";
        String contentType = file.getContentType() != null ? file.getContentType() : "audio/webm";

        String lang = normalizeLanguageHint(languageHint);
        long startTime = System.currentTimeMillis();

        // 1. Try Hugging Face hosted router if token is available
        String token = getEffectiveHfToken();
        if (token != null && !token.isBlank()) {
            try {
                log.info("[ASR] Attempting transcription via Hugging Face router ({})", MODEL_ID);
                String transcript = transcribeViaHf(audioBytes, contentType, lang, token);
                if (transcript != null && !transcript.isBlank()) {
                    long duration = System.currentTimeMillis() - startTime;
                    return Map.of(
                            "status", "success",
                            "text", transcript.trim(),
                            "language", lang,
                            "modelId", MODEL_ID,
                            "provider", "Hugging Face Inference Router",
                            "durationMs", duration
                    );
                }
            } catch (Exception hfEx) {
                log.warn("[ASR] Hugging Face router failed or quota exceeded: {}. Falling back to hosted Groq Whisper.", hfEx.getMessage());
            }
        }

        // 2. High-speed hosted fallback via Groq Whisper Large v3
        String groqKey = getEffectiveGroqKey();
        if (groqKey != null && !groqKey.isBlank()) {
            try {
                log.info("[ASR] Transcribing via hosted Groq Whisper Large v3 ({} bytes, lang: {})", audioBytes.length, lang);
                String transcript = transcribeViaGroq(audioBytes, originalFilename, contentType, lang, groqKey);
                long duration = System.currentTimeMillis() - startTime;
                return Map.of(
                        "status", "success",
                        "text", transcript.trim(),
                        "language", lang,
                        "modelId", MODEL_ID,
                        "provider", "Groq Hosted Whisper Large v3",
                        "durationMs", duration
                );
            } catch (Exception groqEx) {
                log.error("[ASR] Groq Whisper transcription failed: {}", groqEx.getMessage());
                throw new RuntimeException("Speech transcription failed across providers: " + groqEx.getMessage());
            }
        }

        throw new IllegalStateException("No Speech-to-Text inference provider credentials (HF_TOKEN or GROQ_API_KEY) are configured.");
    }

    private String transcribeViaHf(byte[] audioBytes, String contentType, String lang, String token) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(hfEndpoint))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", contentType)
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .POST(HttpRequest.BodyPublishers.ofByteArray(audioBytes))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() == 200) {
            JsonNode root = objectMapper.readTree(response.body());
            if (root.has("text")) {
                return root.get("text").asText("");
            }
            return response.body();
        } else {
            throw new RuntimeException("HF HTTP " + response.statusCode() + ": " + response.body());
        }
    }

    private String transcribeViaGroq(byte[] audioBytes, String filename, String contentType, String lang, String apiKey) throws Exception {
        String boundary = "----WhisperBoundary" + UUID.randomUUID().toString();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        // Model parameter
        baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        baos.write("Content-Disposition: form-data; name=\"model\"\r\n\r\n".getBytes(StandardCharsets.UTF_8));
        baos.write("whisper-large-v3\r\n".getBytes(StandardCharsets.UTF_8));

        // Language parameter if specified
        if (!"auto".equalsIgnoreCase(lang) && !lang.isBlank()) {
            baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            baos.write("Content-Disposition: form-data; name=\"language\"\r\n\r\n".getBytes(StandardCharsets.UTF_8));
            baos.write((lang + "\r\n").getBytes(StandardCharsets.UTF_8));
        }

        // File part
        baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        baos.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        baos.write(("Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        baos.write(audioBytes);
        baos.write("\r\n".getBytes(StandardCharsets.UTF_8));

        // End boundary
        baos.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.groq.com/openai/v1/audio/transcriptions"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .POST(HttpRequest.BodyPublishers.ofByteArray(baos.toByteArray()))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() == 200) {
            JsonNode root = objectMapper.readTree(response.body());
            return root.path("text").asText("");
        } else {
            throw new RuntimeException("Groq ASR HTTP " + response.statusCode() + ": " + response.body());
        }
    }

    private String normalizeLanguageHint(String hint) {
        return com.coderarmy.ragsupport.model.LanguageRegistry.normalizeCode(hint);
    }

    private String getEffectiveHfToken() {
        String env = System.getenv("HF_TOKEN");
        if (env != null && !env.isBlank()) return env.trim();
        if (hfToken != null && !hfToken.isBlank() && !hfToken.startsWith("${")) return hfToken.trim();
        return null;
    }

    private String getEffectiveGroqKey() {
        String env = System.getenv("GROQ_API_KEY");
        if (env != null && !env.isBlank()) return env.trim();
        if (groqApiKey != null && !groqApiKey.isBlank() && !groqApiKey.startsWith("${")) return groqApiKey.trim();
        return "";
    }
}
