package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.TtsLanguageInfo;
import com.coderarmy.ragsupport.model.TtsRequest;
import com.coderarmy.ragsupport.service.TextToSpeechService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TtsControllerTest {

    private MockMvc mockMvc;
    private TextToSpeechService ttsService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        ttsService = Mockito.mock(TextToSpeechService.class);
        TtsController controller = new TtsController(ttsService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void testGetLanguages() throws Exception {
        when(ttsService.getSupportedLanguages()).thenReturn(List.of(
                new TtsLanguageInfo("en", "English", "English", "Female", "Clear voice"),
                new TtsLanguageInfo("hi", "Hindi", "हिंदी", "Rohit", "Rohit voice"),
                new TtsLanguageInfo("mr", "Marathi", "मराठी", "Sunita", "Sunita voice")
        ));

        mockMvc.perform(get("/api/tts/languages"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$[0].code").value("en"))
                .andExpect(jsonPath("$[1].code").value("hi"))
                .andExpect(jsonPath("$[2].code").value("mr"));
    }

    @Test
    void testGetStatus() throws Exception {
        when(ttsService.getStatus()).thenReturn(Map.of(
                "status", "AVAILABLE",
                "modelId", "google/multilingual-tts",
                "provider", "Google Hosted Multilingual Speech Engine"
        ));

        mockMvc.perform(get("/api/tts/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.modelId").value("google/multilingual-tts"));
    }

    @Test
    void testSpeakSuccess() throws Exception {
        byte[] fakeMp3 = new byte[]{'I', 'D', '3', 4, 0, 0, 0, 0, 0, 10, 'T', 'E', 'S', 'T'};
        TextToSpeechService.AudioResult mockResult = new TextToSpeechService.AudioResult(
                fakeMp3,
                "audio/mpeg",
                "mr",
                "नमस्कार",
                "google/multilingual-tts",
                false,
                150L
        );

        when(ttsService.synthesize(any(TtsRequest.class))).thenReturn(mockResult);

        TtsRequest req = new TtsRequest("Hello! Today, I will explain...", "mr");

        mockMvc.perform(post("/api/tts/speak")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "audio/mpeg"))
                .andExpect(header().string("X-TTS-Model", "google/multilingual-tts"))
                .andExpect(header().string("X-TTS-Language", "mr"))
                .andExpect(content().bytes(fakeMp3));
    }

    @Test
    void testSpeakEmptyTextBadRequest() throws Exception {
        when(ttsService.synthesize(any(TtsRequest.class)))
                .thenThrow(new IllegalArgumentException("Text cannot be empty for speech synthesis."));

        TtsRequest req = new TtsRequest("", "en");

        mockMvc.perform(post("/api/tts/speak")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value("error"))
                .andExpect(jsonPath("$.error").value("Text cannot be empty for speech synthesis."));
    }
}
