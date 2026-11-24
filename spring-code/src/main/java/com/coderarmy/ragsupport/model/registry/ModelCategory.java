package com.coderarmy.ragsupport.model.registry;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * The 12 official model categories for Yash AI Multimodal Platform.
 * Supports categorization across text, vision, image generation, video, speech, and embeddings.
 */
public enum ModelCategory {
    TEXT_GENERATION_AND_REASONING(
            "text-generation-and-reasoning",
            "Text Generation & Reasoning",
            "General conversations, coding, mathematics, deep reasoning, instruction following, and long-context analysis."
    ),
    ANY_TO_ANY_MULTIMODAL(
            "any-to-any-multimodal",
            "Any-to-Any Multimodal Models",
            "Frontier models capable of natively accepting and producing combinations of text, image, audio, and video."
    ),
    IMAGE_AND_TEXT_TO_TEXT(
            "image-and-text-to-text",
            "Image & Text to Text",
            "Visual question answering, multimodal comprehension, document QA, chart interpretation, and visual reasoning."
    ),
    IMAGE_TO_TEXT(
            "image-to-text",
            "Image to Text",
            "Image captioning, photographic description, visual analysis, printed document extraction, and OCR."
    ),
    IMAGE_TO_IMAGE(
            "image-to-image",
            "Image to Image",
            "Image editing, image variations, inpainting, outpainting, image transformation, and reference-image conditioning."
    ),
    TEXT_TO_IMAGE(
            "text-to-image",
            "Text to Image",
            "Photorealistic text-to-image synthesis, digital art, illustrations, diagrams, and concept art."
    ),
    TEXT_TO_VIDEO(
            "text-to-video",
            "Text to Video",
            "Text-prompt video generation, animation, cinematic motion synthesis, and short video clips."
    ),
    TEXT_TO_SPEECH(
            "text-to-speech",
            "Text to Speech",
            "Natural neural speech synthesis, multilingual voice generation, Indian language voice support, and streaming audio."
    ),
    SPEECH_TO_TEXT_AND_AUDIO_UNDERSTANDING(
            "speech-to-text-and-audio-understanding",
            "Speech to Text & Audio Understanding",
            "Transcription, speech-to-text translation, multilingual ASR, audio QA, and acoustic understanding."
    ),
    AUDIO_TO_AUDIO(
            "audio-to-audio",
            "Audio to Audio",
            "Voice conversion, speech-to-speech translation, audio transformation, and sound effect generation."
    ),
    VIDEO_TO_TEXT_AND_VIDEO_UNDERSTANDING(
            "video-to-text-and-video-understanding",
            "Video to Text & Video Understanding",
            "Video summarization, scene understanding, visual question answering over video, and temporal reasoning."
    ),
    EMBEDDINGS_AND_RERANKING(
            "embeddings-and-reranking",
            "Embeddings & Reranking",
            "Dense multilingual embeddings, semantic search, document retrieval, Pinecone vector indexing, and neural reranking."
    );

    private final String key;
    private final String label;
    private final String description;

    ModelCategory(String key, String label, String description) {
        this.key = key;
        this.label = label;
        this.description = description;
    }

    @JsonValue
    public String getKey() {
        return key;
    }

    public String getLabel() {
        return label;
    }

    public String getDescription() {
        return description;
    }

    public static ModelCategory fromKey(String key) {
        if (key == null) return null;
        for (ModelCategory c : values()) {
            if (c.key.equalsIgnoreCase(key) || c.name().equalsIgnoreCase(key)) {
                return c;
            }
        }
        return null;
    }
}
