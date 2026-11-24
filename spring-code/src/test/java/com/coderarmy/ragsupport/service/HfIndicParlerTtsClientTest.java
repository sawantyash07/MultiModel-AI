package com.coderarmy.ragsupport.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class HfIndicParlerTtsClientTest {

    private HfIndicParlerTtsClient client;
    private HttpClient mockHttpClient;

    @BeforeEach
    void setUp() {
        mockHttpClient = Mockito.mock(HttpClient.class);
        client = new HfIndicParlerTtsClient(null, mockHttpClient);
    }

    @Test
    void testSpeakerProfilesForAllLanguages() {
        // Test key languages
        assertEquals("Rohit", client.getSpeakerForLanguage("hi").getName());
        assertEquals("Sunita", client.getSpeakerForLanguage("mr").getName());
        assertEquals("Aditi", client.getSpeakerForLanguage("bn").getName());
        assertEquals("Jaya", client.getSpeakerForLanguage("ta").getName());
        assertEquals("Prakash", client.getSpeakerForLanguage("te").getName());
        assertEquals("Suresh", client.getSpeakerForLanguage("kn").getName());
        assertEquals("Anjali", client.getSpeakerForLanguage("ml").getName());
        assertEquals("Jaya", client.getSpeakerForLanguage("gu").getName());
        assertEquals("Rohit", client.getSpeakerForLanguage("pa").getName());
        assertEquals("Rohit", client.getSpeakerForLanguage("ur").getName());
        assertEquals("Natural", client.getSpeakerForLanguage("en").getName());

        // Check fallback for null / unknown
        assertNotNull(client.getSpeakerForLanguage(null));
        assertNotNull(client.getSpeakerForLanguage("unknown"));
    }

    @Test
    void testExtractAudioUrlFromSseStreamWithDuplicateGradioPath() throws Exception {
        String sseData = "event: generating\n" +
                "data: null\n\n" +
                "event: complete\n" +
                "data: [{\"path\": \"/tmp/gradio/abc/audio\", \"url\": \"https://ai4bharat-indic-parler-tts.hf.space/gradio_api/c/gradio_api/file=/tmp/gradio/abc/audio\"}]\n\n";

        InputStream stream = new ByteArrayInputStream(sseData.getBytes(StandardCharsets.UTF_8));
        String resolvedUrl = client.extractAudioUrlFromSseStream(stream, "https://ai4bharat-indic-parler-tts.hf.space");

        assertNotNull(resolvedUrl);
        // Ensure /gradio_api/c/gradio_api/ was fixed to /gradio_api/
        assertEquals("https://ai4bharat-indic-parler-tts.hf.space/gradio_api/file=/tmp/gradio/abc/audio", resolvedUrl);
        assertFalse(resolvedUrl.contains("/c/gradio_api/"));
    }

    @Test
    void testExtractAudioUrlFromSseStreamWithPathFallback() throws Exception {
        String sseData = "event: complete\n" +
                "data: [{\"path\": \"/tmp/gradio/123/audio.mp3\"}]\n\n";

        InputStream stream = new ByteArrayInputStream(sseData.getBytes(StandardCharsets.UTF_8));
        String resolvedUrl = client.extractAudioUrlFromSseStream(stream, "https://ai4bharat-indic-parler-tts.hf.space");

        assertNotNull(resolvedUrl);
        assertEquals("https://ai4bharat-indic-parler-tts.hf.space/gradio_api/file=/tmp/gradio/123/audio.mp3", resolvedUrl);
    }

    @Test
    void testSynthesizeEndToEndMock() throws Exception {
        // Mock Step 1: POST /gradio_api/call/generate_finetuned -> 200 with event_id
        HttpResponse<String> callResponse = Mockito.mock(HttpResponse.class);
        when(callResponse.statusCode()).thenReturn(200);
        when(callResponse.body()).thenReturn("{\"event_id\":\"test_event_123\"}");

        // Mock Step 2: GET /gradio_api/call/generate_finetuned/{event_id} -> SSE stream
        String sseData = "event: complete\n" +
                "data: [{\"url\": \"https://ai4bharat-indic-parler-tts.hf.space/gradio_api/file=/tmp/test.mp3\"}]\n\n";
        HttpResponse<InputStream> streamResponse = Mockito.mock(HttpResponse.class);
        when(streamResponse.statusCode()).thenReturn(200);
        when(streamResponse.body()).thenReturn(new ByteArrayInputStream(sseData.getBytes(StandardCharsets.UTF_8)));

        // Mock Step 3: GET audio file -> 200 with ID3 header MP3 binary
        byte[] fakeMp3 = new byte[]{'I', 'D', '3', 4, 0, 0, 0, 0, 0, 10, 1, 2, 3};
        HttpResponse<byte[]> audioResponse = Mockito.mock(HttpResponse.class);
        when(audioResponse.statusCode()).thenReturn(200);
        when(audioResponse.body()).thenReturn(fakeMp3);

        when(mockHttpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(callResponse)
                .thenReturn(streamResponse)
                .thenReturn(audioResponse);

        byte[] result = client.synthesize("नमस्ते", "hi");
        assertNotNull(result);
        assertEquals(fakeMp3.length, result.length);
        assertEquals('I', (char) result[0]);
        assertEquals('D', (char) result[1]);
        assertEquals('3', (char) result[2]);
    }
}
