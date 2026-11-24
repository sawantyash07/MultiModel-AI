package com.coderarmy.ragsupport.service.provider;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Central registry and dispatcher for all AI Inference Providers.
 * Resolves the appropriate provider dynamically based on model ID,
 * provider configuration, or default fallback preferences.
 */
@Service
public class ProviderRegistry {

    private static final Logger log = LoggerFactory.getLogger(ProviderRegistry.class);

    @Value("${ai.provider.active:gemini}")
    private String configuredActiveProvider;

    @Value("${ai.provider.default-model:gemini-2.5-flash}")
    private String configuredDefaultModel;

    private final GeminiProvider geminiProvider;
    private final OllamaProvider ollamaProvider;
    private final HfInferenceProvider hfProvider;
    private final GroqProvider groqProvider;

    @Autowired
    public ProviderRegistry(
            GeminiProvider geminiProvider,
            OllamaProvider ollamaProvider,
            HfInferenceProvider hfProvider,
            GroqProvider groqProvider
    ) {
        this.geminiProvider = geminiProvider;
        this.ollamaProvider = ollamaProvider;
        this.hfProvider = hfProvider;
        this.groqProvider = groqProvider;
    }

    public ProviderRegistry(
            GeminiProvider geminiProvider,
            OllamaProvider ollamaProvider,
            HfInferenceProvider hfProvider
    ) {
        this(geminiProvider, ollamaProvider, hfProvider, null);
    }

    public List<AiProvider> getAllProviders() {
        List<AiProvider> list = new ArrayList<>();
        list.add(geminiProvider);
        if (groqProvider != null) list.add(groqProvider);
        list.add(ollamaProvider);
        list.add(hfProvider);
        return list;
    }

    public AiProvider getProviderById(String id) {
        if (id == null) return getActiveProvider();
        return switch (id.toLowerCase().trim()) {
            case "groq" -> (groqProvider != null) ? groqProvider : getActiveProvider();
            case "gemini" -> geminiProvider;
            case "ollama" -> ollamaProvider;
            case "huggingface", "hf" -> hfProvider;
            default -> getActiveProvider();
        };
    }

    public AiProvider getActiveProvider() {
        String active = System.getenv("AI_PROVIDER");
        if (active == null || active.isBlank()) {
            active = configuredActiveProvider;
        }
        if (active == null || active.isBlank()) {
            active = "gemini";
        }

        return switch (active.toLowerCase().trim()) {
            case "groq" -> (groqProvider != null) ? groqProvider : geminiProvider;
            case "ollama" -> ollamaProvider;
            case "huggingface", "hf" -> hfProvider;
            default -> geminiProvider;
        };
    }

    public String resolveDefaultModel() {
        String envModel = System.getenv("AI_DEFAULT_MODEL");
        if (envModel != null && !envModel.isBlank()) {
            return envModel.trim();
        }
        if (configuredDefaultModel != null && !configuredDefaultModel.isBlank()) {
            return configuredDefaultModel.trim();
        }
        AiProvider active = getActiveProvider();
        if ("groq".equalsIgnoreCase(active.getProviderId())) {
            return "qwen/qwen3.8-27b";
        } else if ("ollama".equalsIgnoreCase(active.getProviderId())) {
            return "qwen2.5:7b";
        } else if ("huggingface".equalsIgnoreCase(active.getProviderId())) {
            return "Qwen/Qwen2.5-7B-Instruct";
        }
        return "gemini-2.5-flash";
    }

    /**
     * Resolves the corresponding provider for the given model ID.
     */
    public AiProvider resolveProvider(String modelId) {
        if (modelId == null || modelId.isBlank() || "auto".equalsIgnoreCase(modelId)) {
            return getActiveProvider();
        }

        String m = modelId.toLowerCase().trim();

        // 0. Explicit Groq models
        if (groqProvider != null && (m.startsWith("groq/") || m.contains("qwen3.8") || m.contains("gpt-oss") || m.contains("llama-3.3") || m.equals("llama-3.1-8b-instant") || m.contains("versatile") || m.contains("groq"))) {
            return groqProvider;
        }

        // 1. Explicit Local Ollama models
        if (m.startsWith("ollama/") || m.contains(":7b") || m.contains(":8b") || m.contains(":latest") ||
                m.equals("qwen2.5:7b") || m.equals("llama3.1:8b") || m.equals("mistral:7b") || m.equals("deepseek-r1:8b")) {
            return ollamaProvider;
        }

        // 2. Multimodal Vision / Image-to-Text models ALWAYS route to GeminiProvider (verified 100% working multimodal vision)
        if (geminiProvider != null && (
                m.contains("vision") ||
                m.contains("image") ||
                m.contains("blip") ||
                m.contains("vit-gpt2") ||
                m.contains("trocr") ||
                m.contains("git-base") ||
                m.contains("glm-ocr") ||
                m.contains("caption") ||
                m.contains("ocr") ||
                m.contains("florence") ||
                m.contains("moondream") ||
                m.contains("vl") ||
                m.contains("pollinations"))) {
            return geminiProvider;
        }

        // 3. Explicit Gemini models
        if (geminiProvider != null && (m.startsWith("gemini") || m.contains("flash") || m.contains("gemini-1.5") || m.contains("gemini-2.5") || m.contains("gemini-3.5"))) {
            return geminiProvider;
        }

        // 4. Hugging Face models - ONLY if hfProvider is configured with an active token
        if (hfProvider != null && hfProvider.isConfigured() && (m.contains("qwen2.5-7b") || m.contains("phi-4") || m.contains("gemma-3"))) {
            return hfProvider;
        }

        // Fallback to active provider (Gemini or Groq) - prevents any unsupported HF router 400 errors
        return getActiveProvider();
    }

    public Map<String, Object> getProvidersStatus() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("activeProvider", getActiveProvider().getProviderId());
        map.put("defaultModel", resolveDefaultModel());

        Map<String, Object> details = new LinkedHashMap<>();
        for (AiProvider p : getAllProviders()) {
            details.put(p.getProviderId(), Map.of(
                    "name", p.getDisplayName(),
                    "configured", p.isConfigured(),
                    "available", p.isAvailable(),
                    "status", p.getStatusDescription()
            ));
        }
        map.put("providers", details);
        return map;
    }
}
