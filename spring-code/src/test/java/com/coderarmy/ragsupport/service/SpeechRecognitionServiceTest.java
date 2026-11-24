package com.coderarmy.ragsupport.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class SpeechRecognitionServiceTest {

    @Test
    @DisplayName("Test speech-to-text validation rejects empty audio file")
    public void testEmptyFileRejection() {
        SpeechRecognitionService asr = new SpeechRecognitionService();
        MockMultipartFile emptyFile = new MockMultipartFile("file", "test.webm", "audio/webm", new byte[0]);

        assertThrows(IllegalArgumentException.class, () -> {
            asr.transcribe(emptyFile, "en");
        });
    }

    @Test
    @DisplayName("Test fact verification web search triggers with user override")
    public void testFactVerificationOverride() {
        FactVerificationService factService = new FactVerificationService(new WebSearchService());

        // Explicit user override TRUE forces web search even on simple greetings
        assertTrue(factService.requiresWebSearch("hello", Collections.emptyList(), true));

        // Explicit user override FALSE disables web search even on factual queries
        assertFalse(factService.requiresWebSearch("what is the latest release of Java?", Collections.emptyList(), false));

        // Auto mode activates on factual queries
        assertTrue(factService.requiresWebSearch("what is the latest release of Java?", Collections.emptyList(), null));

        // Auto mode skips simple greetings
        assertFalse(factService.requiresWebSearch("hello there", Collections.emptyList(), null));
    }
}
