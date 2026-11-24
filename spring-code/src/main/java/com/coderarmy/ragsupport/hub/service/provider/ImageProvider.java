package com.coderarmy.ragsupport.hub.service.provider;

import com.coderarmy.ragsupport.hub.model.ImageGenerationRequest;
import com.coderarmy.ragsupport.hub.model.ImageGenerationResponse;
import com.coderarmy.ragsupport.hub.service.PromptUnderstandingService.PromptSpecification;

import java.util.List;

/**
 * Common Provider Adapter interface for Image Generation and Editing.
 * Allows seamless integration of Google Gemini, OpenAI, Pollinations/FLUX, and Hugging Face.
 */
public interface ImageProvider {

    String getProviderId();

    String getDisplayName();

    boolean supportsModel(String modelId);

    ImageGenerationResponse generateImage(ImageGenerationRequest request, PromptSpecification spec, long startTime);

    ImageGenerationResponse editImage(ImageGenerationRequest request, PromptSpecification spec, List<String> referenceImages, long startTime);

    boolean isAvailable();

    String getAccessRequirement();

    List<String> getSupportedModels();

    default ImageProviderStatusCache.ProviderHealthStatus checkConnectivity(String modelId) {
        return new ImageProviderStatusCache.ProviderHealthStatus(getProviderId(), modelId, isAvailable() ? "AVAILABLE" : "UNAVAILABLE");
    }
}
