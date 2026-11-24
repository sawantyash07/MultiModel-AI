package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.service.DocumentIntelligenceService;
import com.coderarmy.ragsupport.service.SpeechRecognitionService;
import com.coderarmy.ragsupport.service.TextToSpeechService;
import com.coderarmy.ragsupport.service.UserMemoryService;
import com.coderarmy.ragsupport.service.provider.GeminiProvider;
import com.coderarmy.ragsupport.service.provider.GroqProvider;
import com.coderarmy.ragsupport.service.provider.HfInferenceProvider;
import com.coderarmy.ragsupport.service.provider.OllamaProvider;
import com.coderarmy.ragsupport.service.provider.ProviderRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class HealthSettingsController {

    @Value("${server.port:8080}")
    private String serverPort;

    @Value("${pinecone.api-key:}")
    private String pineconeApiKey;

    @Value("${pinecone.index-name:shop-support}")
    private String pineconeIndex;

    private final ProviderRegistry providerRegistry;
    private final GeminiProvider geminiProvider;
    private final OllamaProvider ollamaProvider;
    private final HfInferenceProvider hfProvider;
    private final GroqProvider groqProvider;
    private final UserMemoryService userMemoryService;
    private final SpeechRecognitionService speechRecognitionService;
    private final DocumentIntelligenceService documentIntelligenceService;
    private final TextToSpeechService textToSpeechService;

    @Autowired
    public HealthSettingsController(
            ProviderRegistry providerRegistry,
            GeminiProvider geminiProvider,
            OllamaProvider ollamaProvider,
            HfInferenceProvider hfProvider,
            @Autowired(required = false) GroqProvider groqProvider,
            UserMemoryService userMemoryService,
            @Autowired(required = false) SpeechRecognitionService speechRecognitionService,
            @Autowired(required = false) DocumentIntelligenceService documentIntelligenceService,
            @Autowired(required = false) TextToSpeechService textToSpeechService
    ) {
        this.providerRegistry = providerRegistry;
        this.geminiProvider = geminiProvider;
        this.ollamaProvider = ollamaProvider;
        this.hfProvider = hfProvider;
        this.groqProvider = groqProvider;
        this.userMemoryService = userMemoryService;
        this.speechRecognitionService = speechRecognitionService != null ? speechRecognitionService : new SpeechRecognitionService();
        this.documentIntelligenceService = documentIntelligenceService != null ? documentIntelligenceService : new DocumentIntelligenceService();
        this.textToSpeechService = textToSpeechService != null ? textToSpeechService : new TextToSpeechService(providerRegistry);
    }

    public HealthSettingsController(
            ProviderRegistry providerRegistry,
            GeminiProvider geminiProvider,
            OllamaProvider ollamaProvider,
            HfInferenceProvider hfProvider
    ) {
        this(providerRegistry, geminiProvider, ollamaProvider, hfProvider, null, new UserMemoryService(), new SpeechRecognitionService(), new DocumentIntelligenceService(), new TextToSpeechService(providerRegistry));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getHealth() {
        boolean pineconeConfigured = (pineconeApiKey != null && !pineconeApiKey.isBlank());

        Map<String, Object> services = new LinkedHashMap<>();
        services.put("server", Map.of("status", "running", "port", serverPort));
        services.put("memory", Map.of(
                "status", "Active (Persistent)",
                "count", (userMemoryService != null) ? userMemoryService.getAllMemories().size() : 0,
                "storage", "data/memories.json"
        ));
        services.put("websearch", Map.of(
                "status", "Active (Live Internet Research)",
                "engines", "Brave Search, Tavily, Serper, DuckDuckGo, Wikipedia",
                "antiHallucination", "Enabled"
        ));
        services.put("voice_asr", Map.of(
                "status", "Active (Multilingual ASR)",
                "modelId", SpeechRecognitionService.MODEL_ID,
                "supportedLanguages", "22 Scheduled Indian Languages + English"
        ));
        services.put("tts", Map.of(
                "status", "Active (Natural Pronunciation)",
                "activeEngine", TextToSpeechService.HOSTING_PROVIDER,
                "candidateModel", "ai4bharat/indic-parler-tts",
                "supportedLanguagesCount", TextToSpeechService.SUPPORTED_LANGUAGES.size(),
                "coverage", "22 Scheduled Indian Languages + English"
        ));
        services.put("documents", Map.of(
                "status", "Active (Document Intelligence RAG)",
                "formats", "PDF, DOCX, XLSX, XLS, CSV, TXT, MD",
                "features", "Page Citations, Table Extraction, Scanned PDF OCR Detection"
        ));
        services.put("gemini", Map.of(
                "configured", geminiProvider.isConfigured(),
                "status", geminiProvider.getStatusDescription(),
                "mode", "Free-Tier Hosted"
        ));
        services.put("groq", (groqProvider != null) ? Map.of(
                "configured", groqProvider.isConfigured(),
                "status", groqProvider.getStatusDescription(),
                "mode", "High-Speed Hosted (LPU)",
                "fallbackTarget", true
        ) : Map.of(
                "configured", false,
                "status", "Missing GROQ_API_KEY",
                "mode", "High-Speed Hosted (LPU)",
                "fallbackTarget", false
        ));
        services.put("ollama", Map.of(
                "configured", ollamaProvider.isConfigured(),
                "status", ollamaProvider.getStatusDescription(),
                "mode", "Local Hardware"
        ));
        services.put("huggingface", Map.of(
                "configured", hfProvider.isConfigured(),
                "status", hfProvider.getStatusDescription(),
                "mode", "Hosted Router"
        ));
        services.put("pinecone", Map.of(
                "configured", pineconeConfigured,
                "status", pineconeConfigured ? "Connected" : "Disconnected",
                "indexName", pineconeIndex,
                "dimension", 1024,
                "indexes", List.of(Map.of("name", pineconeIndex, "dimension", 1024, "metric", "cosine", "state", "Ready"))
        ));

        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "timestamp", new Date().toString(),
                "activeProvider", providerRegistry.getActiveProvider().getProviderId(),
                "services", services
        ));
    }

    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("appName", "Yash AI Multimodal Assistant");
        map.put("version", "3.5.0");
        map.put("runtime", "Spring Boot (Port " + serverPort + ")");
        map.put("activeProvider", providerRegistry.getActiveProvider().getProviderId());
        map.put("defaultModel", providerRegistry.resolveDefaultModel());
        map.put("pineconeIndex", pineconeIndex);
        map.put("persistentMemory", true);
        map.put("liveWebSearch", true);
        map.put("documentIntelligence", true);
        map.put("voiceConversations", true);
        map.put("supportedLanguages", List.of("en", "hi", "mr"));
        map.put("antiHallucinationVerification", true);
        map.put("multiProviderSupport", true);
        return ResponseEntity.ok(map);
    }
}

