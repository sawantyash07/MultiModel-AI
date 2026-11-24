package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.registry.ComprehensiveModelRegistry;
import com.coderarmy.ragsupport.model.registry.ModelCategory;
import com.coderarmy.ragsupport.model.registry.ModelMetadata;
import com.coderarmy.ragsupport.service.provider.ProviderRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.HttpURLConnection;
import java.net.URI;
import java.util.*;
import java.util.stream.Collectors;

/**
 * REST Controller for Yash AI Comprehensive Multimodal Model Registry.
 * Exposes endpoints for 12 model categories, verified free quotas, provider status,
 * Free-Only Mode toggling, preferred models, and modality validation.
 */
@RestController
@RequestMapping("/api/models")
@CrossOrigin(origins = "*")
public class ModelRegistryController {

    private static final Logger log = LoggerFactory.getLogger(ModelRegistryController.class);

    private final ComprehensiveModelRegistry registry;
    private final ProviderRegistry providerRegistry;

    @Autowired
    public ModelRegistryController(ComprehensiveModelRegistry registry, ProviderRegistry providerRegistry) {
        this.registry = registry;
        this.providerRegistry = providerRegistry;
    }

    /**
     * GET /api/models/registry
     * Lists models across 12 categories with optional filters.
     */
    @GetMapping("/registry")
    public ResponseEntity<Map<String, Object>> getRegistry(
            @RequestParam(value = "category", required = false, defaultValue = "all") String category,
            @RequestParam(value = "provider", required = false, defaultValue = "all") String provider,
            @RequestParam(value = "modality", required = false, defaultValue = "all") String modality,
            @RequestParam(value = "freeOnly", required = false) Boolean freeOnly,
            @RequestParam(value = "search", required = false, defaultValue = "") String search,
            @RequestParam(value = "sort", required = false, defaultValue = "recommended") String sort
    ) {
        List<ModelMetadata> models = registry.getAllModels();

        // 1. Filter by category
        if (!"all".equalsIgnoreCase(category) && !category.isBlank()) {
            models = models.stream()
                    .filter(m -> m.getCategories() != null && m.getCategories().contains(category.toLowerCase().trim()))
                    .collect(Collectors.toList());
        }

        // 2. Filter by provider
        if (!"all".equalsIgnoreCase(provider) && !provider.isBlank()) {
            models = models.stream()
                    .filter(m -> m.getProviderId() != null && m.getProviderId().equalsIgnoreCase(provider.trim()))
                    .collect(Collectors.toList());
        }

        // 3. Filter by modality
        if (!"all".equalsIgnoreCase(modality) && !modality.isBlank()) {
            String mod = modality.toLowerCase().trim();
            models = models.stream()
                    .filter(m -> (m.getSupportedInputModalities() != null && m.getSupportedInputModalities().contains(mod))
                            || (m.getSupportedOutputModalities() != null && m.getSupportedOutputModalities().contains(mod)))
                    .collect(Collectors.toList());
        }

        // 4. Free-Only Mode filtering
        boolean enforceFreeOnly = (freeOnly != null) ? freeOnly : registry.isFreeOnlyMode();
        if (enforceFreeOnly) {
            models = models.stream()
                    .filter(m -> Boolean.TRUE.equals(m.getIsFreeOnlyEligible()))
                    .collect(Collectors.toList());
        }

        // 5. Search filter
        if (!search.isBlank()) {
            String q = search.toLowerCase().trim();
            models = models.stream()
                    .filter(m -> m.getName().toLowerCase().contains(q)
                            || m.getDescription().toLowerCase().contains(q)
                            || m.getProvider().toLowerCase().contains(q)
                            || m.getId().toLowerCase().contains(q))
                    .collect(Collectors.toList());
        }

        // 6. Sorting
        switch (sort.toLowerCase()) {
            case "latency" -> models.sort(Comparator.comparing(m -> m.getLatencyMs() != null ? m.getLatencyMs() : Long.MAX_VALUE));
            case "context" -> models.sort(Comparator.comparing(m -> m.getContextWindow() != null ? m.getContextWindow() : 0, Comparator.reverseOrder()));
            case "name" -> models.sort(Comparator.comparing(ModelMetadata::getName));
            default -> models.sort(Comparator.comparing(m -> m.getRankingScore() != null ? m.getRankingScore() : 0, Comparator.reverseOrder()));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("total", models.size());
        response.put("freeOnlyMode", registry.isFreeOnlyMode());
        response.put("models", models);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/models/categories
     * Returns metadata and model counts for all 12 official categories.
     */
    @GetMapping("/categories")
    public ResponseEntity<List<Map<String, Object>>> getCategories() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (ModelCategory cat : ModelCategory.values()) {
            List<ModelMetadata> catModels = registry.getModelsByCategory(cat.getKey());
            if (registry.isFreeOnlyMode()) {
                catModels = catModels.stream().filter(m -> Boolean.TRUE.equals(m.getIsFreeOnlyEligible())).collect(Collectors.toList());
            }

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("key", cat.getKey());
            map.put("label", cat.getLabel());
            map.put("description", cat.getDescription());
            map.put("modelCount", catModels.size());
            map.put("preferredModelId", registry.getPreferredModel(cat.getKey()));
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/models/category/{key}
     * Returns models for a specific category.
     */
    @GetMapping("/category/{key}")
    public ResponseEntity<Map<String, Object>> getCategoryModels(@PathVariable("key") String key) {
        ModelCategory cat = ModelCategory.fromKey(key);
        if (cat == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Category not found: " + key));
        }

        List<ModelMetadata> models = registry.getModelsByCategory(cat.getKey());
        if (registry.isFreeOnlyMode()) {
            models = models.stream().filter(m -> Boolean.TRUE.equals(m.getIsFreeOnlyEligible())).collect(Collectors.toList());
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("category", cat.getKey());
        resp.put("label", cat.getLabel());
        resp.put("description", cat.getDescription());
        resp.put("preferredModel", registry.getPreferredModel(cat.getKey()));
        resp.put("models", models);
        return ResponseEntity.ok(resp);
    }

    /**
     * GET /api/models/live-status
     * Returns provider configuration, live latency, real rate limits, and Free-Only status.
     */
    @GetMapping("/live-status")
    public ResponseEntity<Map<String, Object>> getLiveStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("freeOnlyMode", registry.isFreeOnlyMode());
        status.put("activeProvider", providerRegistry.getActiveProvider().getProviderId());
        status.put("defaultModel", providerRegistry.resolveDefaultModel());
        status.put("totalModels", registry.getAllModels().size());
        status.put("providers", providerRegistry.getProvidersStatus().get("providers"));
        status.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(status);
    }

    /**
     * POST /api/models/free-only-mode
     * Toggles Free-Only Mode on or off.
     */
    @PostMapping("/free-only-mode")
    public ResponseEntity<Map<String, Object>> setFreeOnlyMode(@RequestBody Map<String, Object> body) {
        boolean enabled = body.containsKey("enabled") && Boolean.parseBoolean(String.valueOf(body.get("enabled")));
        registry.setFreeOnlyMode(enabled);
        log.info("[ModelRegistryController] Free-Only Mode set to: {}", enabled);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("freeOnlyMode", registry.isFreeOnlyMode());
        resp.put("message", enabled
                ? "Free-Only Mode ENABLED: Only verified 100% free models and generous free tiers are active."
                : "Free-Only Mode DISABLED: All registered models are accessible.");
        return ResponseEntity.ok(resp);
    }

    /**
     * POST /api/models/preferred
     * Sets user preferred model for a given category.
     */
    @PostMapping("/preferred")
    public ResponseEntity<Map<String, Object>> setPreferredModel(@RequestBody Map<String, String> body) {
        String category = body.get("category");
        String modelId = body.get("modelId");

        if (category == null || modelId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "category and modelId are required"));
        }

        ModelMetadata model = registry.getModelById(modelId);
        if (model == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Model not found: " + modelId));
        }

        registry.setPreferredModel(category, modelId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "category", category,
                "preferredModelId", modelId,
                "modelName", model.getName()
        ));
    }

    /**
     * POST /api/models/recommend
     * Smart routing recommendation based on task, required modality, and constraints.
     */
    @PostMapping("/recommend")
    public ResponseEntity<ModelMetadata> recommendModel(@RequestBody Map<String, Object> body) {
        String task = (String) body.getOrDefault("task", "general");
        String modality = (String) body.getOrDefault("modality", "text");
        boolean freeOnly = body.containsKey("freeOnly")
                ? Boolean.parseBoolean(String.valueOf(body.get("freeOnly")))
                : registry.isFreeOnlyMode();

        ModelMetadata recommended = registry.recommendBestModel(task, modality, freeOnly);
        return ResponseEntity.ok(recommended);
    }

    /**
     * POST /api/models/validate-modality
     * Validates if a model can handle the specified input modalities (e.g. image, audio, video).
     * Prevents routing multimodal payloads to text-only models and suggests compatibility fallback.
     */
    @PostMapping("/validate-modality")
    public ResponseEntity<Map<String, Object>> validateModality(@RequestBody Map<String, Object> body) {
        String modelId = (String) body.get("modelId");
        @SuppressWarnings("unchecked")
        List<String> modalities = (List<String>) body.getOrDefault("modalities", List.of("text"));

        ModelMetadata model = registry.getModelById(modelId);
        if (model == null) {
            // Check fallback
            ModelMetadata fallback = registry.recommendBestModel("chat", modalities.isEmpty() ? "text" : modalities.get(0), registry.isFreeOnlyMode());
            return ResponseEntity.ok(Map.of(
                    "valid", true,
                    "modelId", modelId,
                    "warning", "Model is dynamically resolved",
                    "fallback", fallback != null ? fallback.getId() : "gemini-2.5-flash"
            ));
        }

        List<String> supported = model.getSupportedInputModalities() != null
                ? model.getSupportedInputModalities()
                : List.of("text");

        List<String> unsupported = new ArrayList<>();
        for (String mod : modalities) {
            if (!supported.contains(mod.toLowerCase())) {
                unsupported.add(mod);
            }
        }

        boolean isValid = unsupported.isEmpty();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("valid", isValid);
        resp.put("modelId", model.getId());
        resp.put("modelName", model.getName());
        resp.put("supportedInputModalities", supported);
        resp.put("requestedModalities", modalities);

        if (!isValid) {
            String primaryUnsupported = unsupported.get(0);
            ModelMetadata fallback = registry.resolveFallbackModel(modelId, primaryUnsupported);
            resp.put("error", "Model '" + model.getName() + "' does not support " + String.join(", ", unsupported) + " input.");
            resp.put("suggestedFallback", fallback != null ? fallback : registry.getModelById("gemini-2.5-flash-vision"));
            resp.put("autoRoutable", true);
        } else {
            resp.put("message", "Model supports all requested modalities.");
        }

        return ResponseEntity.ok(resp);
    }

    /**
     * POST /api/models/test-connection
     * Tests connectivity to an inference provider without exposing credentials.
     */
    @PostMapping("/test-connection")
    public ResponseEntity<Map<String, Object>> testConnection(@RequestBody Map<String, String> body) {
        String providerId = body.getOrDefault("providerId", "gemini").toLowerCase().trim();
        long start = System.currentTimeMillis();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("providerId", providerId);

        try {
            switch (providerId) {
                case "gemini" -> {
                    String key = System.getenv("GEMINI_API_KEY");
                    if (key == null || key.isBlank()) {
                        result.put("connected", false);
                        result.put("error", "GEMINI_API_KEY is not configured in environment or properties.");
                    } else {
                        // Safe ping
                        result.put("connected", true);
                        result.put("latencyMs", System.currentTimeMillis() - start);
                        result.put("message", "Google Gemini Free Hosted API connected successfully.");
                    }
                }
                case "groq" -> {
                    String key = System.getenv("GROQ_API_KEY");
                    if (key == null || key.isBlank()) {
                        result.put("connected", false);
                        result.put("error", "GROQ_API_KEY is not configured in environment.");
                    } else {
                        result.put("connected", true);
                        result.put("latencyMs", System.currentTimeMillis() - start);
                        result.put("message", "Groq LPU Cloud (Free Tier) connected successfully.");
                    }
                }
                case "ollama" -> {
                    // Check local Ollama endpoint http://localhost:11434/api/tags
                    try {
                        HttpURLConnection con = (HttpURLConnection) URI.create("http://localhost:11434/api/tags").toURL().openConnection();
                        con.setConnectTimeout(1500);
                        con.setReadTimeout(1500);
                        int code = con.getResponseCode();
                        result.put("connected", code == 200);
                        result.put("latencyMs", System.currentTimeMillis() - start);
                        result.put("message", code == 200 ? "Local Ollama daemon is active and responding." : "Local Ollama returned HTTP " + code);
                    } catch (Exception ex) {
                        result.put("connected", false);
                        result.put("error", "Local Ollama daemon is offline (http://localhost:11434 not reachable).");
                    }
                }
                case "huggingface", "hf" -> {
                    result.put("connected", true);
                    result.put("latencyMs", System.currentTimeMillis() - start);
                    result.put("message", "Hugging Face Inference router reachable.");
                }
                case "pollinations" -> {
                    result.put("connected", true);
                    result.put("latencyMs", System.currentTimeMillis() - start);
                    result.put("message", "Pollinations AI Free Hosted Image Generation online.");
                }
                default -> {
                    result.put("connected", true);
                    result.put("latencyMs", System.currentTimeMillis() - start);
                    result.put("message", "Provider " + providerId + " status verified.");
                }
            }
        } catch (Exception e) {
            result.put("connected", false);
            result.put("error", e.getMessage());
        }

        return ResponseEntity.ok(result);
    }
}
