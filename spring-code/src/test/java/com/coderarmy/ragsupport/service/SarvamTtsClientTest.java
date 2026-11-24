package com.coderarmy.ragsupport.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SarvamTtsClientTest {

    private SarvamTtsClient client;

    @BeforeEach
    void setUp() {
        client = new SarvamTtsClient();
    }

    @Test
    void testSupportedLanguages() {
        // Must support 11 languages
        assertTrue(client.supportsLanguage("en"));
        assertTrue(client.supportsLanguage("hi"));
        assertTrue(client.supportsLanguage("bn"));
        assertTrue(client.supportsLanguage("ta"));
        assertTrue(client.supportsLanguage("te"));
        assertTrue(client.supportsLanguage("kn"));
        assertTrue(client.supportsLanguage("ml"));
        assertTrue(client.supportsLanguage("mr"));
        assertTrue(client.supportsLanguage("gu"));
        assertTrue(client.supportsLanguage("pa"));
        assertTrue(client.supportsLanguage("or"));

        // Must reject unsupported languages
        assertFalse(client.supportsLanguage("as"));
        assertFalse(client.supportsLanguage("sa"));
        assertFalse(client.supportsLanguage("kok"));
        assertFalse(client.supportsLanguage("brx"));
        assertFalse(client.supportsLanguage(null));
    }

    @Test
    void testConfiguredState() {
        // Without API key, isConfigured should be false unless env var is present
        String env = System.getenv("SARVAM_API_KEY");
        if (env == null || env.isBlank()) {
            assertFalse(client.isConfigured());
        }
    }

    @Test
    void testModelAndProviderNames() {
        assertEquals("bulbul:v4-flash", client.getModelId());
        assertEquals("Sarvam AI Bulbul (v4-flash / v3)", client.getProviderName());
    }
}
