package com.coderarmy.ragsupport.hub.service;

import com.coderarmy.ragsupport.hub.model.HubModel;
import com.coderarmy.ragsupport.hub.model.ImageGenerationRequest;
import com.coderarmy.ragsupport.hub.model.ImageGenerationResponse;
import com.coderarmy.ragsupport.hub.service.PromptUnderstandingService.PromptSpecification;
import com.coderarmy.ragsupport.hub.service.provider.ImageProviderRegistry;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Dedicated task service for Text-to-Image synthesis and Image Editing in Model Hub and Chat.
 * Utilizes the PromptUnderstandingService for maximum prompt fidelity,
 * dispatches via ImageProviderRegistry across Google Gemini, OpenAI, and FLUX providers,
 * and maintains persisted gallery history with full generation metadata.
 */
@Service
public class TextToImageService {

    private static final Logger log = LoggerFactory.getLogger(TextToImageService.class);

    private final HubRegistryService registryService;
    private final PromptUnderstandingService promptUnderstandingService;
    private final ImageProviderRegistry imageProviderRegistry;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final List<ImageGenerationResponse> imageHistory = new CopyOnWriteArrayList<>();
    private final File historyFile = new File("data/hub_images.json");

    @Autowired
    public TextToImageService(
            HubRegistryService registryService,
            PromptUnderstandingService promptUnderstandingService,
            ImageProviderRegistry imageProviderRegistry
    ) {
        this.registryService = registryService;
        this.promptUnderstandingService = promptUnderstandingService;
        this.imageProviderRegistry = imageProviderRegistry;
    }

    public TextToImageService(HubRegistryService registryService) {
        this.registryService = registryService;
        this.promptUnderstandingService = new PromptUnderstandingService();
        com.coderarmy.ragsupport.hub.service.provider.PollinationsImageProvider pollinations =
                new com.coderarmy.ragsupport.hub.service.provider.PollinationsImageProvider();
        this.imageProviderRegistry = new ImageProviderRegistry(
                List.of(
                        new com.coderarmy.ragsupport.hub.service.provider.GeminiImageProvider(),
                        new com.coderarmy.ragsupport.hub.service.provider.OpenAiImageProvider(),
                        pollinations,
                        new com.coderarmy.ragsupport.hub.service.provider.HuggingFaceImageProvider()
                ),
                pollinations,
                new com.coderarmy.ragsupport.hub.service.provider.ImageProviderStatusCache()
        );
    }

    @PostConstruct
    public void init() {
        loadHistory();
    }

    public ImageGenerationResponse generateImage(ImageGenerationRequest request) {
        long startTime = System.currentTimeMillis();
        String modelId = request.getModelId() != null ? request.getModelId() : "flux-schnell-free";
        HubModel model = registryService.getModel(modelId);
        String modelName = model != null ? model.getName() : modelId;
        String provider = model != null ? model.getProvider() : "External";
        String prompt = request.getPrompt() != null ? request.getPrompt().trim() : "";

        if (prompt.isEmpty()) {
            return ImageGenerationResponse.error("Prompt cannot be empty.", modelId, modelName, provider, prompt, 0);
        }

        // 1. Analyze prompt through Prompt Understanding & Fidelity Engine
        boolean allowEnhance = Boolean.TRUE.equals(request.getEnhancePrompt());
        PromptSpecification spec = promptUnderstandingService.analyzePrompt(prompt, request.getAspectRatio(), modelId, allowEnhance);

        // 2. Execute via Image Provider Architecture with Smart Failover
        ImageGenerationResponse result = imageProviderRegistry.executeWithFallback(request, spec, startTime);

        if ("SUCCESS".equalsIgnoreCase(result.getStatus()) && result.getImageDataUrl() != null) {
            saveToHistory(result);
        }

        return result;
    }

    public List<ImageGenerationResponse> getImageHistory() {
        return new ArrayList<>(imageHistory);
    }

    public com.coderarmy.ragsupport.hub.service.provider.ImageProviderStatusCache.ProviderHealthStatus checkProvider(String providerId, String modelId) {
        return imageProviderRegistry.checkProvider(providerId, modelId);
    }

    public Map<String, Object> getProviderStatuses() {
        return imageProviderRegistry.getStatusCache().getAllStatuses();
    }

    public boolean deleteImage(String id) {
        boolean removed = imageHistory.removeIf(item -> item.getId() != null && item.getId().equalsIgnoreCase(id));
        if (removed) {
            persistHistory();
        }
        return removed;
    }

    private synchronized void saveToHistory(ImageGenerationResponse item) {
        imageHistory.add(0, item);
        if (imageHistory.size() > 50) {
            imageHistory.remove(imageHistory.size() - 1);
        }
        persistHistory();
    }

    private void persistHistory() {
        try {
            if (!historyFile.getParentFile().exists()) {
                historyFile.getParentFile().mkdirs();
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(historyFile, imageHistory);
        } catch (Exception e) {
            log.warn("[TextToImage] Failed to persist image history to {}: {}", historyFile.getPath(), e.getMessage());
        }
    }

    private void loadHistory() {
        try {
            if (historyFile.exists() && historyFile.length() > 0) {
                List<ImageGenerationResponse> list = objectMapper.readValue(historyFile, new TypeReference<List<ImageGenerationResponse>>() {});
                imageHistory.clear();
                imageHistory.addAll(list);
                log.info("[TextToImage] Loaded {} generated images from history.", imageHistory.size());
            }
        } catch (Exception e) {
            log.warn("[TextToImage] Could not load image history from {}: {}", historyFile.getPath(), e.getMessage());
        }
    }
}
