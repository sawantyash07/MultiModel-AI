package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.TtsLanguageInfo;
import com.coderarmy.ragsupport.model.TtsRequest;
import com.coderarmy.ragsupport.service.TextToSpeechService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * REST Controller for Multilingual Text-to-Speech (TTS) operations.
 * Serves live playable audio binaries generated via remote Hugging Face hosted inference.
 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/tts")
public class TtsController {

    private static final Logger log = LoggerFactory.getLogger(TtsController.class);

    private final TextToSpeechService ttsService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public TtsController(TextToSpeechService ttsService) {
        this.ttsService = ttsService;
    }

    /**
     * POST /api/tts/speak
     * Synthesizes the requested text into audio using the hosted Hugging Face TTS model.
     * Returns playable binary audio (audio/mpeg) or JSON payload with exact word timestamps.
     */
    @PostMapping(value = "/speak", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> speak(
            @RequestBody TtsRequest request,
            @RequestHeader(value = "Accept", required = false) String acceptHeader
    ) {
        log.info("[Voice Diagnostic] POST /api/tts/speak - lang='{}', textLen={}, convId='{}', msgId='{}', accept='{}'",
                request != null ? request.getLanguage() : null,
                (request != null && request.getText() != null) ? request.getText().length() : 0,
                request != null ? request.getConversationId() : null,
                request != null ? request.getMessageId() : null,
                acceptHeader);
        try {
            TextToSpeechService.AudioResult result = ttsService.synthesize(request);

            // Handle JSON response if explicitly requested
            if (acceptHeader != null && acceptHeader.contains(MediaType.APPLICATION_JSON_VALUE)) {
                Map<String, Object> jsonBody = new LinkedHashMap<>();
                jsonBody.put("status", "success");
                jsonBody.put("audioBase64", Base64.getEncoder().encodeToString(result.getAudioBytes()));
                jsonBody.put("contentType", result.getContentType());
                jsonBody.put("language", result.getLanguage());
                jsonBody.put("spokenText", result.getSpokenText());
                jsonBody.put("modelId", result.getModelId());
                jsonBody.put("provider", result.getProvider());
                jsonBody.put("cached", result.isCached());
                jsonBody.put("durationMs", result.getDurationMs());
                jsonBody.put("generationLatencyMs", result.getGenerationLatencyMs());
                jsonBody.put("exactAlignment", result.isExactAlignment());
                jsonBody.put("timestamps", result.getTimestamps());

                return ResponseEntity.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(jsonBody);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(result.getContentType()));
            headers.setContentLength(result.getAudioBytes().length);
            headers.set("X-TTS-Model", result.getModelId());
            headers.set("X-TTS-Provider", result.getProvider());
            headers.set("X-TTS-Language", result.getLanguage());
            headers.set("X-TTS-Cached", String.valueOf(result.isCached()));
            headers.set("X-TTS-Duration-Ms", String.valueOf(result.getDurationMs()));
            headers.set("X-TTS-Latency-Ms", String.valueOf(result.getGenerationLatencyMs()));
            headers.set("X-TTS-Exact-Alignment", String.valueOf(result.isExactAlignment()));

            // Encode spoken text in Base64 to safely transport Unicode Hindi / Marathi in HTTP headers
            if (result.getSpokenText() != null) {
                String b64Text = Base64.getEncoder().encodeToString(result.getSpokenText().getBytes(StandardCharsets.UTF_8));
                headers.set("X-TTS-Spoken-Text", b64Text);
            }

            // Transport aligned word timestamps in HTTP header if size allows (under 7KB header safety boundary)
            if (result.getTimestamps() != null && !result.getTimestamps().isEmpty()) {
                try {
                    String jsonTimestamps = objectMapper.writeValueAsString(result.getTimestamps());
                    byte[] jsonBytes = jsonTimestamps.getBytes(StandardCharsets.UTF_8);
                    if (jsonBytes.length <= 6000) {
                        String b64Timestamps = Base64.getEncoder().encodeToString(jsonBytes);
                        headers.set("X-TTS-Word-Timestamps", b64Timestamps);
                    }
                } catch (Exception ex) {
                    log.debug("[TTS Controller] Could not serialize timestamps to header: {}", ex.getMessage());
                }
            }

            headers.set("Cache-Control", "public, max-age=86400");
            headers.set("Access-Control-Expose-Headers", "X-TTS-Model, X-TTS-Provider, X-TTS-Language, X-TTS-Cached, X-TTS-Duration-Ms, X-TTS-Latency-Ms, X-TTS-Exact-Alignment, X-TTS-Spoken-Text, X-TTS-Word-Timestamps");

            return new ResponseEntity<>(result.getAudioBytes(), headers, HttpStatus.OK);

        } catch (IllegalArgumentException e) {
            log.warn("[TTS Controller] Bad request: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("status", "error", "error", e.getMessage()));

        } catch (UnsupportedOperationException e) {
            log.info("[TTS Controller] Language preview limitation: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "status", "preview_limitation",
                            "error", e.getMessage(),
                            "modelId", TextToSpeechService.MODEL_ID,
                            "provider", TextToSpeechService.HOSTING_PROVIDER
                    ));

        } catch (Exception e) {
            log.error("[TTS Controller] Synthesis error: {}", e.getMessage());
            int statusCode = HttpStatus.INTERNAL_SERVER_ERROR.value();
            if (e.getMessage() != null && e.getMessage().contains("401")) {
                statusCode = HttpStatus.UNAUTHORIZED.value();
            } else if (e.getMessage() != null && e.getMessage().contains("402")) {
                statusCode = HttpStatus.PAYMENT_REQUIRED.value();
            } else if (e.getMessage() != null && e.getMessage().contains("429")) {
                statusCode = HttpStatus.TOO_MANY_REQUESTS.value();
            } else if (e.getMessage() != null && e.getMessage().contains("HTTP")) {
                statusCode = HttpStatus.BAD_GATEWAY.value();
            }

            return ResponseEntity.status(statusCode)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "status", "error",
                            "error", e.getMessage() != null ? e.getMessage() : "TTS generation failed",
                            "modelId", TextToSpeechService.MODEL_ID,
                            "provider", TextToSpeechService.HOSTING_PROVIDER
                    ));
        }
    }

    /**
     * GET /api/tts/languages
     * Returns the list of verified supported languages and their speaker specifications.
     */
    @GetMapping("/languages")
    public ResponseEntity<List<TtsLanguageInfo>> getLanguages() {
        return ResponseEntity.ok(ttsService.getSupportedLanguages());
    }

    /**
     * GET /api/tts/status
     * Returns runtime metadata and provider status of the TTS service.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(ttsService.getStatus());
    }

    /**
     * DELETE /api/tts/cache
     * Clears cached audio binaries from memory.
     */
    @DeleteMapping("/cache")
    public ResponseEntity<Map<String, Object>> clearCache() {
        ttsService.clearCache();
        return ResponseEntity.ok(Map.of("status", "success", "message", "TTS audio cache cleared successfully."));
    }
}
