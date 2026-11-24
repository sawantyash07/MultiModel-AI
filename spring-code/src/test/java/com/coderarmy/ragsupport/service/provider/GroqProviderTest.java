package com.coderarmy.ragsupport.service.provider;

import com.coderarmy.ragsupport.service.ConversationStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.codec.ServerSentEvent;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class GroqProviderTest {

    private ConversationStorageService storageService;
    private GroqProvider groqProvider;
    private GeminiProvider geminiProvider;
    private OllamaProvider ollamaProvider;
    private HfInferenceProvider hfProvider;
    private ProviderRegistry providerRegistry;

    @BeforeEach
    void setUp() {
        storageService = new ConversationStorageService();
        groqProvider = new GroqProvider(storageService);
        geminiProvider = new GeminiProvider(storageService, groqProvider);
        ollamaProvider = new OllamaProvider(storageService);
        hfProvider = new HfInferenceProvider(storageService);
        providerRegistry = new ProviderRegistry(geminiProvider, ollamaProvider, hfProvider, groqProvider);
    }

    @Test
    void testGroqProviderMetadata() {
        assertEquals("groq", groqProvider.getProviderId());
        assertEquals("Groq (Free High-Speed)", groqProvider.getDisplayName());
        assertTrue(groqProvider.supportsModel("llama-3.3-70b-versatile"));
        assertTrue(groqProvider.supportsModel("llama-3.1-8b-instant"));
        assertTrue(groqProvider.supportsModel("groq/custom"));
        assertFalse(groqProvider.supportsModel("gemini-2.5-flash"));
        assertFalse(groqProvider.supportsModel("qwen2.5:7b"));
    }

    @Test
    void testGroqModelResolution() {
        assertEquals("qwen/qwen3.8-27b", groqProvider.resolveGroqModel("auto"));
        assertEquals("qwen/qwen3.8-27b", groqProvider.resolveGroqModel(null));
        assertEquals("qwen/qwen3.8-27b", groqProvider.resolveGroqModel("qwen/qwen3.8-27b"));
        assertEquals("qwen/qwen3.8-27b", groqProvider.resolveGroqModel("llama-3.3-70b-versatile"));
        assertEquals("openai/gpt-oss-120b", groqProvider.resolveGroqModel("openai/gpt-oss-120b"));
        assertEquals("openai/gpt-oss-120b", groqProvider.resolveGroqModel("120b"));
    }

    @Test
    void testProviderRegistryRouting() {
        // Groq models route to GroqProvider
        AiProvider p1 = providerRegistry.resolveProvider("llama-3.3-70b-versatile");
        assertEquals("groq", p1.getProviderId());

        AiProvider p2 = providerRegistry.resolveProvider("llama-3.1-8b-instant");
        assertEquals("groq", p2.getProviderId());

        AiProvider p3 = providerRegistry.resolveProvider("groq/anything");
        assertEquals("groq", p3.getProviderId());

        // Gemini models route to GeminiProvider
        AiProvider pGemini = providerRegistry.resolveProvider("gemini-2.5-flash");
        assertEquals("gemini", pGemini.getProviderId());

        // Ollama models route to OllamaProvider
        AiProvider pOllama = providerRegistry.resolveProvider("qwen2.5:7b");
        assertEquals("ollama", pOllama.getProviderId());
    }

    @Test
    void testGroqMissingKeyReturnsGracefulErrorSse() {
        // If GROQ_API_KEY is not configured in this test env
        if (!groqProvider.isConfigured()) {
            Flux<ServerSentEvent<String>> stream = groqProvider.streamChat(
                    "llama-3.3-70b-versatile",
                    List.of(Map.of("role", "user", "content", "Hello")),
                    System.currentTimeMillis(),
                    "conv-test-groq"
            );

            List<ServerSentEvent<String>> events = stream.collectList().block();
            assertNotNull(events);
            assertFalse(events.isEmpty());

            // Should have error event and done event
            boolean hasError = events.stream().anyMatch(e -> "error".equals(e.event()) && e.data().contains("GROQ_API_KEY"));
            assertTrue(hasError, "Should return informative error event instructing user to set GROQ_API_KEY");
        }
    }

    @Test
    void testProviderStatusIncludesGroq() {
        Map<String, Object> status = providerRegistry.getProvidersStatus();
        assertNotNull(status);
        @SuppressWarnings("unchecked")
        Map<String, Object> providers = (Map<String, Object>) status.get("providers");
        assertNotNull(providers);
        assertTrue(providers.containsKey("groq"), "Provider status map must include 'groq'");
        assertTrue(providers.containsKey("gemini"), "Provider status map must include 'gemini'");
        assertTrue(providers.containsKey("ollama"), "Provider status map must include 'ollama'");
        assertTrue(providers.containsKey("huggingface"), "Provider status map must include 'huggingface'");
    }
}
