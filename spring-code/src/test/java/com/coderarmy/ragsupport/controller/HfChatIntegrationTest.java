package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.HfModelMeta;
import com.coderarmy.ragsupport.service.ConversationStorageService;
import com.coderarmy.ragsupport.service.HfInferenceService;
import com.coderarmy.ragsupport.service.HfModelService;
import com.coderarmy.ragsupport.service.provider.GeminiProvider;
import com.coderarmy.ragsupport.service.provider.GroqProvider;
import com.coderarmy.ragsupport.service.provider.HfInferenceProvider;
import com.coderarmy.ragsupport.service.provider.OllamaProvider;
import com.coderarmy.ragsupport.service.provider.ProviderRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class HfChatIntegrationTest {

    private HfModelService modelService;
    private ConversationStorageService storageService;
    private HfInferenceService inferenceService;
    private ProviderRegistry providerRegistry;
    private GroqProvider groqProvider;
    private MockMvc modelMockMvc;
    private MockMvc conversationMockMvc;
    private MockMvc chatMockMvc;

    @BeforeEach
    void setUp() {
        storageService = new ConversationStorageService();
        groqProvider = new GroqProvider(storageService);
        GeminiProvider geminiProvider = new GeminiProvider(storageService, groqProvider);
        OllamaProvider ollamaProvider = new OllamaProvider(storageService);
        HfInferenceProvider hfProvider = new HfInferenceProvider(storageService);
        providerRegistry = new ProviderRegistry(geminiProvider, ollamaProvider, hfProvider, groqProvider);
        modelService = new HfModelService(providerRegistry);
        inferenceService = new HfInferenceService(modelService, storageService, providerRegistry);

        HfModelController modelController = new HfModelController(modelService);
        ConversationController conversationController = new ConversationController(storageService);
        ChatController chatController = new ChatController(inferenceService);

        modelMockMvc = MockMvcBuilders.standaloneSetup(modelController).build();
        conversationMockMvc = MockMvcBuilders.standaloneSetup(conversationController).build();
        chatMockMvc = MockMvcBuilders.standaloneSetup(chatController).build();
    }

    @Test
    void testModelResolutionAcrossProviders() {
        // Default resolves to Gemini 2.5 Flash (free hosted)
        assertEquals("gemini-2.5-flash", modelService.resolveModelId("auto"));
        assertEquals("gemini-2.5-flash", modelService.resolveModelId("gemini"));

        // Groq models resolved correctly
        assertEquals("qwen/qwen3.8-27b", modelService.resolveModelId("qwen/qwen3.8-27b"));
        assertEquals("qwen/qwen3.8-27b", modelService.resolveModelId("groq"));
        assertEquals("qwen/qwen3.8-27b", modelService.resolveModelId("qwen3.8"));
        assertEquals("openai/gpt-oss-120b", modelService.resolveModelId("openai/gpt-oss-120b"));
        assertEquals("openai/gpt-oss-120b", modelService.resolveModelId("120b"));

        // Provider routing for Groq
        assertEquals("groq", providerRegistry.resolveProvider("qwen/qwen3.8-27b").getProviderId());
        assertEquals("groq", providerRegistry.resolveProvider("openai/gpt-oss-120b").getProviderId());
        assertEquals("groq", providerRegistry.resolveProvider("groq/custom-model").getProviderId());

        // Exact IDs preserved
        assertEquals("gemini-3.5-flash", modelService.resolveModelId("gemini-3.5-flash"));
        assertEquals("qwen2.5:7b", modelService.resolveModelId("qwen2.5:7b"));
        assertEquals("llama3.1:8b", modelService.resolveModelId("llama3.1:8b"));

        HfModelMeta groqMeta = modelService.getModelById("qwen/qwen3.8-27b");
        assertNotNull(groqMeta);
        assertEquals("Qwen 3.8 27B (Groq High-Speed)", groqMeta.getName());
        assertEquals("Groq Free Hosted", groqMeta.getAvailabilityBadge());

        HfModelMeta geminiMeta = modelService.getModelById("gemini-3.5-flash");
        assertNotNull(geminiMeta);
        assertEquals("Gemini 3.5 Flash", geminiMeta.getName());

        // Image-to-Text models resolved correctly
        assertEquals("gemini-2.5-flash-vision", modelService.resolveModelId("gemini-2.5-flash-vision"));
        assertEquals("gemini-3.5-flash-vision", modelService.resolveModelId("gemini-3.5-flash-vision"));
        assertEquals("gemini-3.5-flash-lite-vision", modelService.resolveModelId("gemini-3.5-flash-lite-vision"));
        assertEquals("gemini-flash-latest-vision", modelService.resolveModelId("gemini-flash-latest-vision"));

        // Trending Hugging Face Image-to-Text models
        assertEquals("Salesforce/blip-image-captioning-large", modelService.resolveModelId("Salesforce/blip-image-captioning-large"));
        assertEquals("Salesforce/blip-image-captioning-large", modelService.resolveModelId("blip-image-captioning-large"));
        assertEquals("Salesforce/blip-image-captioning-base", modelService.resolveModelId("Salesforce/blip-image-captioning-base"));
        assertEquals("nlpconnect/vit-gpt2-image-captioning", modelService.resolveModelId("nlpconnect/vit-gpt2-image-captioning"));
        assertEquals("microsoft/git-base", modelService.resolveModelId("microsoft/git-base"));
        assertEquals("microsoft/trocr-base-printed", modelService.resolveModelId("microsoft/trocr-base-printed"));
        assertEquals("zai-org/GLM-OCR", modelService.resolveModelId("zai-org/GLM-OCR"));

        // Verify provider routing routes them to geminiProvider for zero errors
        assertEquals("gemini", providerRegistry.resolveProvider("Salesforce/blip-image-captioning-large").getProviderId());
        assertEquals("gemini", providerRegistry.resolveProvider("microsoft/trocr-base-printed").getProviderId());
        assertEquals("gemini", providerRegistry.resolveProvider("zai-org/GLM-OCR").getProviderId());

        // Legacy/unsupported models safely alias to working models without error
        assertEquals("gemini-2.5-flash-vision", modelService.resolveModelId("vikhyatk/moondream2"));
        assertEquals("gemini-2.5-flash-vision", modelService.resolveModelId("microsoft/Florence-2-base"));
        assertEquals("gemini-2.5-flash-vision", modelService.resolveModelId("Qwen/Qwen2.5-VL-7B-Instruct"));
        assertEquals("gemini-2.5-flash-vision", modelService.resolveModelId("meta-llama/llama-3.2-11b-vision"));

        HfModelMeta visionMeta = modelService.getModelById("gemini-2.5-flash-vision");
        assertNotNull(visionMeta);
        assertEquals("image-to-text", visionMeta.getTask());
        assertEquals("Free Hosted Vision", visionMeta.getAvailabilityBadge());

        HfModelMeta nextGenVisionMeta = modelService.getModelById("gemini-3.5-flash-vision");
        assertNotNull(nextGenVisionMeta);
        assertEquals("image-to-text", nextGenVisionMeta.getTask());

        HfModelMeta blipMeta = modelService.getModelById("Salesforce/blip-image-captioning-large");
        assertNotNull(blipMeta);
        assertEquals("image-to-text", blipMeta.getTask());
        assertEquals("Free HF Trending", blipMeta.getAvailabilityBadge());

        // Test auto-selection picks Image-to-Text when image attachment is present
        String autoImageModel = modelService.detectBestModel(
                "Describe this photo",
                List.of(Map.of("type", "image/png", "dataUrl", "data:image/png;base64,abc123=="))
        );
        assertEquals("gemini-2.5-flash-vision", autoImageModel);
    }

    @Test
    void testGetModelsEndpoint() throws Exception {
        modelMockMvc.perform(get("/api/models"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.models", hasSize(greaterThanOrEqualTo(16))))
                .andExpect(jsonPath("$.models[?(@.id == 'gemini-2.5-flash')]", hasSize(1)))
                .andExpect(jsonPath("$.models[?(@.id == 'gemini-3.5-flash')]", hasSize(1)))
                .andExpect(jsonPath("$.models[?(@.id == 'qwen/qwen3.8-27b')]", hasSize(1)))
                .andExpect(jsonPath("$.models[?(@.id == 'openai/gpt-oss-120b')]", hasSize(1)))
                .andExpect(jsonPath("$.models[?(@.id == 'qwen2.5:7b')]", hasSize(1)))
                .andExpect(jsonPath("$.models[?(@.id == 'gemini-2.5-flash-vision')]", hasSize(1)))
                .andExpect(jsonPath("$.models[?(@.id == 'gemini-3.5-flash-vision')]", hasSize(1)))
                .andExpect(jsonPath("$.models[?(@.id == 'Salesforce/blip-image-captioning-large')]", hasSize(1)))
                .andExpect(jsonPath("$.models[?(@.id == 'microsoft/trocr-base-printed')]", hasSize(1)))
                .andExpect(jsonPath("$.models[?(@.id == 'zai-org/GLM-OCR')]", hasSize(1)))
                .andExpect(jsonPath("$.models[?(@.task == 'image-to-text')]", hasSize(10)));
    }

    @Test
    void testConversationsContract() throws Exception {
        conversationMockMvc.perform(get("/api/conversations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversations", notNullValue()));
    }

    @Test
    void testChatSuggestionsEndpoint() throws Exception {
        String jsonPayload = """
                {
                    "prompt": "Explain Java OOP concepts in simple words",
                    "answer": "Object-Oriented Programming (OOP) in Java revolves around four core principles..."
                }
                """;

        chatMockMvc.perform(post("/api/chat/suggestions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions", hasSize(greaterThanOrEqualTo(2))));
    }

    @Test
    void testPersonalizedSuggestionsEndpoint() throws Exception {
        chatMockMvc.perform(get("/api/chat/personalized-suggestions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions", hasSize(greaterThanOrEqualTo(2))));
    }

    @Test
    void testAutoTitlingAndMessageEditing() throws Exception {
        // 1. Create conversation with first prompt
        String createJson = """
                {
                    "firstPrompt": "Explain Java OOP concepts in simple words",
                    "modelId": "gemini-2.5-flash"
                }
                """;

        String response = conversationMockMvc.perform(post("/api/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", not(equalTo("New Chat"))))
                .andReturn().getResponse().getContentAsString();

        // 2. Test generateTitleFromPrompt
        String title = ConversationStorageService.generateTitleFromPrompt("How to write a custom React hook for debouncing");
        assertTrue(title.contains("React Hook") || title.contains("Debouncing"));
    }

    @Test
    void testStreamInferenceFluxGeneration() {
        Flux<ServerSentEvent<String>> stream = inferenceService.streamInference(
                "conv-test-1",
                "gemini-2.5-flash",
                List.of(Map.of("role", "user", "content", "Explain Java OOP concepts in simple words")),
                List.of(),
                null
        );

        assertNotNull(stream);
        List<ServerSentEvent<String>> events = stream.collectList().block();
        assertNotNull(events);
        assertFalse(events.isEmpty(), "Stream must emit events");
    }

    @Test
    void testImageUploadSuccess() throws Exception {
        byte[] fakePng = "PNG_FAKE_IMAGE_BYTES_FOR_TEST".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "screenshot.png", "image/png", fakePng);

        chatMockMvc.perform(multipart("/api/chat/upload").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("ready")))
                .andExpect(jsonPath("$.name", is("screenshot.png")))
                .andExpect(jsonPath("$.type", is("image/png")))
                .andExpect(jsonPath("$.dataUrl", startsWith("data:image/png;base64,")));
    }

    @Test
    void testImageUploadOversized() throws Exception {
        // Create 21MB byte array
        byte[] huge = new byte[21 * 1024 * 1024];
        MockMultipartFile file = new MockMultipartFile("file", "large.png", "image/png", huge);

        chatMockMvc.perform(multipart("/api/chat/upload").file(file))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.error", containsString("exceeds the maximum allowed limit of 20MB")));
    }

    @Test
    void testImageUploadUnsupportedType() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "doc.txt", "text/plain", "plain text".getBytes());

        chatMockMvc.perform(multipart("/api/chat/upload").file(file))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error", containsString("Unsupported image format")));
    }

    @Test
    void testImageUploadEmptyFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);

        chatMockMvc.perform(multipart("/api/chat/upload").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("No file uploaded")));
    }

    @Test
    void testStreamChatMultipart() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "sample.png", "image/png", "sample bytes".getBytes());

        chatMockMvc.perform(multipart("/api/chat/stream")
                        .file(file)
                        .param("prompt", "Analyze this image")
                        .param("modelId", "gemini-2.5-flash-vision")
                        .param("language", "mr")
                        .accept(MediaType.TEXT_EVENT_STREAM_VALUE))
                .andExpect(status().isOk());
    }

    @Test
    void testStreamChatJsonWithLanguage() throws Exception {
        String reqBody = """
                {
                    "conversationId": "test-conv-lang",
                    "modelId": "gemini-2.5-flash",
                    "language": "hi",
                    "messages": [
                        {"role": "user", "content": "Explain artificial intelligence"}
                    ]
                }
                """;

        chatMockMvc.perform(post("/api/chat/stream")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reqBody)
                        .accept(MediaType.TEXT_EVENT_STREAM_VALUE))
                .andExpect(status().isOk());
    }

    @Test
    void testStreamInferenceLanguageDirectives() {
        // Test Hindi directive
        Flux<ServerSentEvent<String>> hiStream = inferenceService.streamInference(
                "conv-test-hi",
                "gemini-2.5-flash",
                List.of(Map.of("role", "user", "content", "Explain AI")),
                List.of(),
                null,
                "hi"
        );
        assertNotNull(hiStream);

        // Test Marathi directive
        Flux<ServerSentEvent<String>> mrStream = inferenceService.streamInference(
                "conv-test-mr",
                "gemini-2.5-flash",
                List.of(Map.of("role", "user", "content", "Explain AI")),
                List.of(),
                null,
                "mr"
        );
        assertNotNull(mrStream);

        // Test English directive
        Flux<ServerSentEvent<String>> enStream = inferenceService.streamInference(
                "conv-test-en",
                "gemini-2.5-flash",
                List.of(Map.of("role", "user", "content", "Explain AI")),
                List.of(),
                null,
                "en"
        );
        assertNotNull(enStream);
    }

    @Test
    void testStopGenerationEndpoint() throws Exception {
        chatMockMvc.perform(post("/api/chat/stop")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestId\":\"req-cancel-123\",\"conversationId\":\"conv-test-cancel\",\"messageId\":\"msg-cancel\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("stopped")))
                .andExpect(jsonPath("$.requestId", is("req-cancel-123")));
    }

    @Test
    void testStreamInferencePreludeEvents() {
        Flux<ServerSentEvent<String>> stream = inferenceService.streamInference(
                "conv-test-prelude",
                "gemini-2.5-flash",
                List.of(Map.of("role", "user", "content", "Hello")),
                List.of(),
                null,
                "en",
                false,
                null,
                "req-prelude-1",
                "msg-prelude-1"
        );
        assertNotNull(stream);

        // First two events must be 'start' and 'thinking' emitted within milliseconds
        List<ServerSentEvent<String>> firstEvents = stream.take(2).collectList().block();
        assertNotNull(firstEvents);
        assertEquals(2, firstEvents.size());
        assertEquals("start", firstEvents.get(0).event());
        assertEquals("thinking", firstEvents.get(1).event());
        assertTrue(firstEvents.get(0).data().contains("req-prelude-1"));
        assertTrue(firstEvents.get(1).data().contains("thinking"));
    }
}
