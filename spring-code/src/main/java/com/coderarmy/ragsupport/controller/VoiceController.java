package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.service.SpeechRecognitionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/voice")
@CrossOrigin(origins = "*")
public class VoiceController {

    private final SpeechRecognitionService speechService;

    public VoiceController(SpeechRecognitionService speechService) {
        this.speechService = speechService;
    }

    /**
     * POST /api/voice/transcribe
     * Transcribes spoken audio into text using OpenAI Whisper Large v3.
     * Supports English, Hindi, and Marathi.
     */
    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> transcribeAudio(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "language", required = false, defaultValue = "en") String language
    ) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No audio file uploaded for transcription."));
        }

        try {
            Map<String, Object> result = speechService.transcribe(file, language);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage(), "status", "failed"));
        }
    }

    /**
     * GET /api/voice/status
     * Returns speech-to-text service status and model information.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getVoiceStatus() {
        return ResponseEntity.ok(Map.of(
                "status", "ACTIVE",
                "modelId", SpeechRecognitionService.MODEL_ID,
                "supportedLanguages", new String[]{"en", "hi", "mr"},
                "multilingual", true
        ));
    }
}
