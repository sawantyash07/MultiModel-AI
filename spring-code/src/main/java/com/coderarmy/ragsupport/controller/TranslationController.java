package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.LanguageRegistry;
import com.coderarmy.ragsupport.service.TranslationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for language translation services.
 * Allows translation of chat messages and user content into any of the 22 Eighth Schedule Indian languages + English.
 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/translate")
public class TranslationController {

    private static final Logger log = LoggerFactory.getLogger(TranslationController.class);

    private final TranslationService translationService;

    @Autowired
    public TranslationController(TranslationService translationService) {
        this.translationService = translationService;
    }

    /**
     * POST /api/translate
     * Translates the provided text into the specified target language.
     */
    @PostMapping
    public ResponseEntity<?> translate(@RequestBody Map<String, Object> request) {
        String text = (String) request.get("text");
        String targetLanguage = (String) request.getOrDefault("targetLanguage", "gu");
        String sourceLanguage = (String) request.getOrDefault("sourceLanguage", "en");

        if (text == null || text.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Text to translate cannot be empty."));
        }

        try {
            long startTime = System.currentTimeMillis();
            String translated = translationService.translateText(text, sourceLanguage, targetLanguage);
            long durationMs = System.currentTimeMillis() - startTime;

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "originalText", text,
                    "translatedText", translated,
                    "sourceLanguage", sourceLanguage,
                    "targetLanguage", targetLanguage,
                    "durationMs", durationMs
            ));
        } catch (Exception e) {
            log.error("[TranslationController] Translation error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "status", "error",
                    "error", e.getMessage() != null ? e.getMessage() : "Translation failed"
            ));
        }
    }

    /**
     * GET /api/translate/languages
     * Returns the list of supported translation languages.
     */
    @GetMapping("/languages")
    public ResponseEntity<?> getLanguages() {
        List<?> langs = LanguageRegistry.getAllLanguages().stream().map(l -> Map.of(
                "code", l.getCode(),
                "name", l.getName(),
                "nativeName", l.getNativeName(),
                "script", l.getScript()
        )).toList();
        return ResponseEntity.ok(langs);
    }
}
