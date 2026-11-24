package com.coderarmy.ragsupport.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class BodhanIndicSpeakClientTest {

    private BodhanIndicSpeakClient client;
    private HttpClient mockHttpClient;

    @BeforeEach
    void setUp() {
        mockHttpClient = Mockito.mock(HttpClient.class);
        client = new BodhanIndicSpeakClient(null, mockHttpClient);
    }

    @Test
    void testIsAvailableRequiresEndpoint() {
        assertFalse(client.isAvailable(), "Client should be unavailable when endpoint is blank");

        client.setEndpoint("https://my-custom-bodhan.example.com/v1/audio/speech");
        assertTrue(client.isAvailable(), "Client should be available when endpoint is set");

        client.setEnabled(false);
        assertFalse(client.isAvailable(), "Client should be unavailable when disabled");
    }

    @Test
    void testSynthesizeOpenAiFormatMock() throws Exception {
        client.setEndpoint("https://api.example.com/v1/audio/speech");
        client.setApiKey("test-key");

        byte[] fakeMp3 = new byte[]{'I', 'D', '3', 4, 0, 0, 0, 0, 0, 10, 5, 6, 7};
        HttpResponse<byte[]> response = Mockito.mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn(fakeMp3);

        when(mockHttpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(response);

        byte[] result = client.synthesize("Hello world", "en");
        assertNotNull(result);
        assertEquals(fakeMp3.length, result.length);
    }
}
