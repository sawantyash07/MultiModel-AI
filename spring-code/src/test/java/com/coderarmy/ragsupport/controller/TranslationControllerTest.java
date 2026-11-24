package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.service.TranslationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class TranslationControllerTest {

    private TranslationController controller;
    private TranslationService mockTranslationService;

    @BeforeEach
    void setUp() {
        mockTranslationService = Mockito.mock(TranslationService.class);
        controller = new TranslationController(mockTranslationService);
    }

    @Test
    void testGetLanguagesReturnsAllSupportedLanguages() {
        ResponseEntity<?> response = controller.getLanguages();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());

        @SuppressWarnings("unchecked")
        List<Map<String, String>> langs = (List<Map<String, String>>) response.getBody();
        assertTrue(langs.size() >= 23, "Should include English + all 22 Eighth Schedule Indian languages");

        // Verify Gujarati is included
        boolean hasGujarati = langs.stream().anyMatch(l -> "gu".equals(l.get("code")));
        assertTrue(hasGujarati, "Should contain Gujarati ('gu')");

        // Verify Hindi is included
        boolean hasHindi = langs.stream().anyMatch(l -> "hi".equals(l.get("code")));
        assertTrue(hasHindi, "Should contain Hindi ('hi')");
    }

    @Test
    void testTranslateBadRequestOnEmptyText() {
        ResponseEntity<?> response = controller.translate(Map.of("text", ""));
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());

        ResponseEntity<?> nullResponse = controller.translate(Map.of());
        assertEquals(HttpStatus.BAD_REQUEST, nullResponse.getStatusCode());
    }

    @Test
    void testTranslateSuccess() throws Exception {
        when(mockTranslationService.translateText("Explain artificial intelligence.", "en", "gu"))
                .thenReturn("કૃત્રિમ બુદ્ધિમત્તા વિશે સરળ શબ્દોમાં સમજાવો.");

        ResponseEntity<?> response = controller.translate(Map.of(
                "text", "Explain artificial intelligence.",
                "sourceLanguage", "en",
                "targetLanguage", "gu"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals("success", body.get("status"));
        assertEquals("કૃત્રિમ બુદ્ધિમત્તા વિશે સરળ શબ્દોમાં સમજાવો.", body.get("translatedText"));
        assertEquals("gu", body.get("targetLanguage"));
    }

    @Test
    void testTranslateServiceFailureReturns500() throws Exception {
        when(mockTranslationService.translateText(anyString(), anyString(), anyString()))
                .thenThrow(new IllegalStateException("Translation provider unavailable"));

        ResponseEntity<?> response = controller.translate(Map.of(
                "text", "Hello world",
                "targetLanguage", "gu"
        ));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals("error", body.get("status"));
        assertTrue(((String) body.get("error")).contains("Translation provider unavailable"));
    }
}
