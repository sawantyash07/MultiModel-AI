package com.coderarmy.ragsupport.hub.controller;

import com.coderarmy.ragsupport.hub.model.*;
import com.coderarmy.ragsupport.hub.service.HubRegistryService;
import com.coderarmy.ragsupport.hub.service.ImageToTextService;
import com.coderarmy.ragsupport.hub.service.TextToImageService;
import com.coderarmy.ragsupport.hub.service.TextToTextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for the AI Model Hub.
 * Exposes endpoints for model catalog, live model verification,
 * Text-to-Text inference, Text-to-Image synthesis, and Image-to-Text vision analysis.
 */
@RestController
@RequestMapping("/api/hub")
@CrossOrigin(origins = "*")
public class ModelHubController {

    private final HubRegistryService registryService;
    private final TextToTextService textToTextService;
    private final TextToImageService textToImageService;
    private final ImageToTextService imageToTextService;
    private final com.coderarmy.ragsupport.hub.service.PromptUnderstandingService promptUnderstandingService;

    @Autowired
    public ModelHubController(
            HubRegistryService registryService,
            TextToTextService textToTextService,
            TextToImageService textToImageService,
            ImageToTextService imageToTextService,
            com.coderarmy.ragsupport.hub.service.PromptUnderstandingService promptUnderstandingService
    ) {
        this.registryService = registryService;
        this.textToTextService = textToTextService;
        this.textToImageService = textToImageService;
        this.imageToTextService = imageToTextService;
        this.promptUnderstandingService = promptUnderstandingService;
    }

    /**
     * GET /api/hub/models
     * Lists models with optional task filtering and search.
     */
    @GetMapping("/models")
    public ResponseEntity<Map<String, Object>> getModels(
            @RequestParam(value = "task", required = false, defaultValue = "all") String task,
            @RequestParam(value = "search", required = false, defaultValue = "") String search
    ) {
        List<HubModel> models = registryService.getAllModels(task, search);

        // Calculate counts per section
        long textToTextCount = registryService.getAllModels("text-to-text", "").size();
        long textToImageCount = registryService.getAllModels("text-to-image", "").size();
        long imageToTextCount = registryService.getAllModels("image-to-text", "").size();

        Map<String, Object> resp = new HashMap<>();
        resp.put("models", models);
        resp.put("counts", Map.of(
                "total", textToTextCount + textToImageCount + imageToTextCount,
                "textToText", textToTextCount,
                "textToImage", textToImageCount,
                "imageToText", imageToTextCount
        ));
        resp.put("hasHfToken", registryService.getEffectiveHfToken() != null);

        return ResponseEntity.ok(resp);
    }

    /**
     * POST /api/hub/models/verify-all
     * Triggers verification across all models in catalog.
     */
    @PostMapping("/models/verify-all")
    public ResponseEntity<Map<String, Object>> verifyAllModels() {
        registryService.verifyAllModels();
        return ResponseEntity.ok(Map.of("message", "Verification cycle initiated"));
    }

    /**
     * POST /api/hub/models/{id}/verify
     * Executes real, live verification of an individual model.
     */
    @PostMapping("/models/{id}/verify")
    public ResponseEntity<HubModel> verifyModel(@PathVariable("id") String id) {
        HubModel verified = registryService.verifyModel(id);
        if (verified == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(verified);
    }

    /**
     * POST /api/hub/text/generate
     * Synchronous Text-to-Text generation endpoint.
     */
    @PostMapping("/text/generate")
    public ResponseEntity<TextGenerationResponse> generateText(@RequestBody TextGenerationRequest request) {
        TextGenerationResponse response = textToTextService.generateText(request);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/hub/text/stream
     * Server-Sent Events (SSE) streaming Text-to-Text generation endpoint.
     */
    @PostMapping(value = "/text/stream", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> streamText(@RequestBody TextGenerationRequest request) {
        return textToTextService.streamText(request);
    }

    /**
     * POST /api/hub/image/generate
     * Text-to-Image synthesis endpoint.
     */
    @PostMapping("/image/generate")
    public ResponseEntity<ImageGenerationResponse> generateImage(@RequestBody ImageGenerationRequest request) {
        ImageGenerationResponse response = textToImageService.generateImage(request);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/hub/image/analyze-prompt
     * Prompt analysis and fidelity specification endpoint.
     */
    @PostMapping("/image/analyze-prompt")
    public ResponseEntity<Map<String, Object>> analyzePrompt(@RequestBody Map<String, Object> body) {
        String prompt = (String) body.getOrDefault("prompt", "");
        String aspect = (String) body.getOrDefault("aspectRatio", "1:1");
        String modelId = (String) body.getOrDefault("modelId", "flux-schnell-free");
        boolean enhance = Boolean.TRUE.equals(body.get("enhancePrompt"));
        com.coderarmy.ragsupport.hub.service.PromptUnderstandingService.PromptSpecification spec =
                promptUnderstandingService.analyzePrompt(prompt, aspect, modelId, enhance);
        return ResponseEntity.ok(spec.toMap());
    }

    /**
     * POST /api/hub/image/providers/{id}/check
     * Executes real, live connectivity or quota check for an image provider.
     */
    @PostMapping("/image/providers/{id}/check")
    public ResponseEntity<Map<String, Object>> checkImageProvider(
            @PathVariable("id") String providerId,
            @RequestParam(value = "modelId", required = false) String modelId
    ) {
        com.coderarmy.ragsupport.hub.service.provider.ImageProviderStatusCache.ProviderHealthStatus status =
                textToImageService.checkProvider(providerId, modelId);
        return ResponseEntity.ok(status.toMap());
    }

    /**
     * GET /api/hub/image/providers/status
     * Returns current cached health, cooldown, and availability states for image providers.
     */
    @GetMapping("/image/providers/status")
    public ResponseEntity<Map<String, Object>> getImageProviderStatuses() {
        return ResponseEntity.ok(textToImageService.getProviderStatuses());
    }

    /**
     * GET /api/hub/image/history
     * Retrieves recent generated image gallery history.
     */
    @GetMapping("/image/history")
    public ResponseEntity<Map<String, Object>> getImageHistory() {
        List<ImageGenerationResponse> history = textToImageService.getImageHistory();
        return ResponseEntity.ok(Map.of("images", history, "total", history.size()));
    }

    /**
     * DELETE /api/hub/image/history/{id}
     * Deletes a specific image from history.
     */
    @DeleteMapping("/image/history/{id}")
    public ResponseEntity<Map<String, Object>> deleteImageHistory(@PathVariable("id") String id) {
        boolean deleted = textToImageService.deleteImage(id);
        return ResponseEntity.ok(Map.of("deleted", deleted, "id", id));
    }

    /**
     * POST /api/hub/vision/analyze (Multipart form upload)
     * Image-to-Text multimodal vision analysis endpoint.
     */
    @PostMapping(value = "/vision/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageAnalysisResponse> analyzeVisionMultipart(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "prompt", required = false) String prompt,
            @RequestParam(value = "modelId", required = false) String modelId
    ) {
        ImageAnalysisResponse response = imageToTextService.analyzeMultipart(file, prompt, modelId);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/hub/vision/analyze (JSON payload with base64 image data)
     */
    @PostMapping(value = "/vision/analyze", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ImageAnalysisResponse> analyzeVisionJson(@RequestBody ImageAnalysisRequest request) {
        ImageAnalysisResponse response = imageToTextService.analyzeJson(request);
        return ResponseEntity.ok(response);
    }
}
