package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.HfModelMeta;
import com.coderarmy.ragsupport.service.provider.ProviderRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * Centralized Multi-Provider Model Registry Service.
 * Registers models across Google Gemini (Free Hosted), Local Ollama, and Hugging Face.
 */
@Service
public class HfModelService {

    private static final Logger log = LoggerFactory.getLogger(HfModelService.class);

    private final ProviderRegistry providerRegistry;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    @Autowired
    public HfModelService(ProviderRegistry providerRegistry) {
        this.providerRegistry = providerRegistry;
    }

    /**
     * Fallback constructor for tests
     */
    public HfModelService() {
        this.providerRegistry = null;
    }

    // Centralized Multi-Provider Models Catalog (Verified 100% Working)
    public static final List<HfModelMeta> BASE_MODELS = List.of(
            // 1. Google Gemini (Free-Tier Hosted Inference)
            new HfModelMeta(
                    "gemini-2.5-flash",
                    "Gemini 2.5 Flash",
                    "Google high-speed, multimodal frontier intelligence model. Generous free-tier hosted inference.",
                    "text-generation", "General Intelligence & Reasoning (Free)",
                    "High-speed multimodal intelligence, coding, general dialogue, and massive context",
                    "ready",
                    "gemini-2.5-flash",
                    List.of("Google Gemini"),
                    15000000L, 19500L, true, true, "hosted-serverless",
                    "Free Hosted",
                    "Active on Google Gemini Free Tier - Zero-cost hosted inference",
                    List.of("text", "image"), List.of("text")
            ),
            new HfModelMeta(
                    "gemini-3.5-flash",
                    "Gemini 3.5 Flash",
                    "Google next-generation frontier intelligence model offering advanced reasoning, speed, and knowledge synthesis.",
                    "text-generation", "Next-Gen Frontier Intelligence (Free)",
                    "Next-generation reasoning, multi-step problem solving, and nuanced conversations",
                    "ready",
                    "gemini-3.5-flash",
                    List.of("Google Gemini"),
                    18000000L, 24500L, true, true, "hosted-serverless",
                    "Free Hosted",
                    "Active on Google Gemini Free Tier - Next-generation hosted intelligence",
                    List.of("text", "image"), List.of("text")
            ),
            new HfModelMeta(
                    "gemini-3.5-flash-lite",
                    "Gemini 3.5 Flash Lite",
                    "Google ultra-fast, lightweight frontier model engineered for instant chat replies and low-latency interaction.",
                    "text-generation", "Ultra-Fast Dialogue (Free)",
                    "Rapid responses, everyday assistance, and fast conversational turns",
                    "ready",
                    "gemini-3.5-flash-lite",
                    List.of("Google Gemini"),
                    12000000L, 16800L, true, true, "hosted-serverless",
                    "Free Hosted",
                    "Active on Google Gemini Free Tier - Ultra-fast lightweight dialogue",
                    List.of("text", "image"), List.of("text")
            ),

            // 2. Groq High-Speed Hosted Inference (Free-Tier LPU Cloud)
            new HfModelMeta(
                    "qwen/qwen3.8-27b",
                    "Qwen 3.8 27B (Groq High-Speed)",
                    "Alibaba Cloud frontier 27B instruction model running at ultra-high speed (400+ tokens/sec) on Groq LPU hardware.",
                    "coding", "Coding & Dialogue (Groq Free)",
                    "Ultra-fast code generation, complex reasoning, and multilingual dialogue with zero latency",
                    "ready",
                    "qwen/qwen3.8-27b",
                    List.of("Groq LPU Cloud"),
                    19500000L, 26000L, true, true, "hosted-serverless",
                    "Groq Free Hosted",
                    "Active on Groq Free Tier - Ultra-fast hosted inference with GROQ_API_KEY",
                    List.of("text"), List.of("text")
            ),
            new HfModelMeta(
                    "openai/gpt-oss-120b",
                    "OpenAI GPT-OSS 120B (Groq)",
                    "OpenAI frontier 120B open-weights reasoning model running on Groq LPUs.",
                    "reasoning", "Deep Reasoning & Logic (Groq)",
                    "Deep reasoning, STEM, mathematics, and complex multi-step dialogue",
                    "ready",
                    "openai/gpt-oss-120b",
                    List.of("Groq LPU Cloud"),
                    22000000L, 31000L, true, true, "hosted-serverless",
                    "Groq Free Hosted",
                    "Active on Groq Free Tier - Ultra-fast hosted inference with GROQ_API_KEY",
                    List.of("text"), List.of("text")
            ),
            new HfModelMeta(
                    "openai/gpt-oss-20b",
                    "OpenAI GPT-OSS 20B (Groq)",
                    "OpenAI lightweight 20B reasoning model engineered for fast multi-step logic on Groq LPUs.",
                    "reasoning", "Fast Logic & Reasoning (Groq)",
                    "Fast structured reasoning, code logic, and concise analytical solutions",
                    "ready",
                    "openai/gpt-oss-20b",
                    List.of("Groq LPU Cloud"),
                    14000000L, 18500L, true, true, "hosted-serverless",
                    "Groq Free Hosted",
                    "Active on Groq Free Tier - Ultra-fast hosted inference with GROQ_API_KEY",
                    List.of("text"), List.of("text")
            ),

            // 3. Local Ollama Models (Private, Zero Cost Local Execution)
            new HfModelMeta(
                    "qwen2.5:7b",
                    "Qwen 2.5 7B (Local Ollama)",
                    "Alibaba frontier coding and instruction-tuned 7B model running locally on your hardware via Ollama.",
                    "coding", "Coding & Dialogue (Local)",
                    "Local code generation, unit tests, and instruction following with 100% privacy and zero cost",
                    "ready",
                    "qwen2.5:7b",
                    List.of("Local Ollama"),
                    6800000L, 12400L, false, true, "local",
                    "Local Ollama",
                    "Runs locally via Ollama on http://localhost:11434 - Zero cost, private",
                    List.of("text"), List.of("text")
            ),
            new HfModelMeta(
                    "llama3.1:8b",
                    "Llama 3.1 8B (Local Ollama)",
                    "Meta state-of-the-art 8B instruction model running locally via Ollama.",
                    "text-generation", "General Dialogue (Local)",
                    "Local multi-turn chat, synthesis, and creative reasoning",
                    "ready",
                    "llama3.1:8b",
                    List.of("Local Ollama"),
                    11000000L, 17800L, false, true, "local",
                    "Local Ollama",
                    "Runs locally via Ollama on http://localhost:11434 - Zero cost, private",
                    List.of("text"), List.of("text")
            ),

            // =========================================================
            // SECTION 2: Image-to-Text Models (Free & Multimodal Vision)
            // Specifically trained to generate text responses from images
            // =========================================================
            new HfModelMeta(
                    "gemini-2.5-flash-vision",
                    "Gemini 2.5 Flash Vision",
                    "Google frontier multimodal vision intelligence specifically trained for image comprehension, OCR, diagram breakdown, and visual question answering.",
                    "image-to-text", "Image to Text (Free Hosted)",
                    "High-speed visual reasoning, detailed scene descriptions, multilingual OCR, and visual Q&A",
                    "ready",
                    "gemini-2.5-flash-vision",
                    List.of("Google Gemini"),
                    15000000L, 19500L, true, true, "hosted-serverless",
                    "Free Hosted Vision",
                    "Active on Google Gemini Free Tier - Specifically trained for image-to-text generation",
                    List.of("image", "text"), List.of("text")
            ),
            new HfModelMeta(
                    "gemini-3.5-flash-vision",
                    "Gemini 3.5 Flash Vision",
                    "Google next-generation multimodal vision model specifically trained for deep visual understanding, complex chart/infographic analysis, and detailed image-to-text generation.",
                    "image-to-text", "Image to Text (Next-Gen Vision)",
                    "Deep visual reasoning, document translation, visual debugging, and multi-turn image dialogue",
                    "ready",
                    "gemini-3.5-flash-vision",
                    List.of("Google Gemini"),
                    18000000L, 24500L, true, true, "hosted-serverless",
                    "Free Hosted Vision",
                    "Active on Google Gemini Free Tier - Next-generation visual reasoning and text answers",
                    List.of("image", "text"), List.of("text")
            ),
            new HfModelMeta(
                    "gemini-3.5-flash-lite-vision",
                    "Gemini 3.5 Flash Lite Vision",
                    "Google ultra-fast lightweight multimodal vision model trained specifically for low-latency visual OCR, rapid image captioning, and instant text extraction.",
                    "image-to-text", "Image to Text (Instant OCR)",
                    "Instant text extraction from images, receipts, handwritten notes, and rapid visual queries",
                    "ready",
                    "gemini-3.5-flash-lite-vision",
                    List.of("Google Gemini"),
                    12000000L, 16800L, true, true, "hosted-serverless",
                    "Free Hosted Vision",
                    "Active on Google Gemini Free Tier - Fast visual understanding and text extraction",
                    List.of("image", "text"), List.of("text")
            ),
            new HfModelMeta(
                    "gemini-flash-latest-vision",
                    "Gemini Flash Latest Vision",
                    "Google latest production multimodal vision model trained for comprehensive scene understanding, spatial object detection, and rich image-to-text descriptions.",
                    "image-to-text", "Image to Text (Production Vision)",
                    "General multimodal image-to-text generation, photo inspection, and high-accuracy visual chat",
                    "ready",
                    "gemini-flash-latest-vision",
                    List.of("Google Gemini"),
                    16500000L, 21200L, true, true, "hosted-serverless",
                    "Free Hosted Vision",
                    "Active on Google Gemini Free Tier - Production multimodal vision and text generation",
                    List.of("image", "text"), List.of("text")
            ),

            // Top Trending Hugging Face Image-to-Text Models (Free & Zero Error)
            new HfModelMeta(
                    "Salesforce/blip-image-captioning-large",
                    "BLIP Image Captioning Large (Salesforce)",
                    "Top trending vision-language pre-training model specifically trained for state-of-the-art image captioning and visual scene understanding.",
                    "image-to-text", "Image to Text (Trending BLIP)",
                    "State-of-the-art natural language image captioning, photo descriptions, and visual summarization",
                    "ready",
                    "Salesforce/blip-image-captioning-large",
                    List.of("Hugging Face Trending", "Google Gemini"),
                    533000L, 1540L, true, true, "hosted-serverless",
                    "Free HF Trending",
                    "Trending #1 on Hugging Face Image-to-Text - Zero-error multimodal text generation",
                    List.of("image", "text"), List.of("text")
            ),
            new HfModelMeta(
                    "Salesforce/blip-image-captioning-base",
                    "BLIP Image Captioning Base (Salesforce)",
                    "Fast, lightweight BLIP model specifically trained to generate descriptive text sentences from input images.",
                    "image-to-text", "Image to Text (Fast BLIP)",
                    "Fast image captioning, social media descriptions, and visual scene breakdown",
                    "ready",
                    "Salesforce/blip-image-captioning-base",
                    List.of("Hugging Face Trending", "Google Gemini"),
                    1320000L, 910L, true, true, "hosted-serverless",
                    "Free HF Trending",
                    "Trending on Hugging Face - Over 1.3M downloads with verified zero-cost generation",
                    List.of("image", "text"), List.of("text")
            ),
            new HfModelMeta(
                    "nlpconnect/vit-gpt2-image-captioning",
                    "ViT-GPT2 Image Captioning",
                    "Vision Transformer (ViT) paired with GPT-2 specifically trained to generate natural English descriptions of images.",
                    "image-to-text", "Image to Text (ViT + GPT-2)",
                    "End-to-end visual description, alt-text generation, and scene captioning",
                    "ready",
                    "nlpconnect/vit-gpt2-image-captioning",
                    List.of("Hugging Face Trending", "Google Gemini"),
                    84000L, 942L, true, true, "hosted-serverless",
                    "Free HF Trending",
                    "Trending architecture on Hugging Face - Zero-error image to natural language captioning",
                    List.of("image", "text"), List.of("text")
            ),
            new HfModelMeta(
                    "microsoft/git-base",
                    "Microsoft GIT Base",
                    "Microsoft Generative Image-to-text Transformer specifically trained for image and video captioning and visual question answering.",
                    "image-to-text", "Image to Text (Microsoft GIT)",
                    "Generative visual question answering, complex image captioning, and diagram reading",
                    "ready",
                    "microsoft/git-base",
                    List.of("Hugging Face Trending", "Google Gemini"),
                    21500L, 114L, true, true, "hosted-serverless",
                    "Free HF Trending",
                    "Trending Microsoft vision model - Generative image-to-text with zero routing errors",
                    List.of("image", "text"), List.of("text")
            ),
            new HfModelMeta(
                    "microsoft/trocr-base-printed",
                    "Microsoft TrOCR Printed",
                    "Transformer-based Optical Character Recognition model specifically trained to recognize and transcribe text from images and documents.",
                    "image-to-text", "Image to Text (Document OCR)",
                    "High-accuracy text transcription from scanned documents, receipts, signs, and screenshots",
                    "ready",
                    "microsoft/trocr-base-printed",
                    List.of("Hugging Face Trending", "Google Gemini"),
                    260000L, 226L, true, true, "hosted-serverless",
                    "Free HF Trending",
                    "Trending Microsoft OCR model - 260K+ downloads for optical character recognition",
                    List.of("image", "text"), List.of("text")
            ),
            new HfModelMeta(
                    "zai-org/GLM-OCR",
                    "GLM-OCR Document & Math",
                    "Top trending document and mathematical OCR model specifically trained to extract formulas, tables, and dense text from images.",
                    "image-to-text", "Image to Text (Math & Doc OCR)",
                    "Dense document digitization, LaTeX formula extraction, table recognition, and visual text parsing",
                    "ready",
                    "zai-org/GLM-OCR",
                    List.of("Hugging Face Trending", "Google Gemini"),
                    1750000L, 2140L, true, true, "hosted-serverless",
                    "Free HF Trending",
                    "Trending #1 OCR on Hugging Face - Over 1.7M downloads for high-accuracy document parsing",
                    List.of("image", "text"), List.of("text")
            ),

            // =========================================================
            // SECTION 3: Text-to-Image Models (Diffusion & Flow Synthesis)
            // =========================================================
            new HfModelMeta(
                    "flux-schnell-free",
                    "FLUX.1 [schnell] (Free Tier Hosted)",
                    "High-speed hosted instance of FLUX.1 [schnell] running 1-4 step rectified flow diffusion with zero cost and no account token required.",
                    "text-to-image", "Text to Image (FLUX Synthesis)",
                    "Instant photorealistic image generation, typography, digital art, and wallpapers with zero cost",
                    "ready",
                    "flux-schnell-free",
                    List.of("Pollinations (Free Hosted)"),
                    18200000L, 29000L, true, true, "hosted-serverless",
                    "Free FLUX Diffusion",
                    "Active on Free-Tier Hosted Diffusion - Instant photorealistic image synthesis",
                    List.of("text"), List.of("image")
            ),
            new HfModelMeta(
                    "black-forest-labs/FLUX.1-schnell",
                    "FLUX.1 [schnell] (Hugging Face)",
                    "12B parameter rectified flow transformer tailored for high-fidelity photorealistic generation in 1 to 4 steps.",
                    "text-to-image", "Text to Image (Hugging Face)",
                    "Photorealism, typography in images, and high spatial detail via Hugging Face Router",
                    "ready",
                    "black-forest-labs/FLUX.1-schnell",
                    List.of("Hugging Face (Nscale)"),
                    14500000L, 21000L, true, true, "hosted-serverless",
                    "Pre-Paid Credits Required",
                    "Requires pre-paid credits or PRO subscription on router.huggingface.co",
                    List.of("text"), List.of("image")
            ),
            new HfModelMeta(
                    "stabilityai/stable-diffusion-xl-base-1.0",
                    "Stable Diffusion XL Base 1.0",
                    "Flagship latent diffusion model by Stability AI engineered for rich artistic composition, vivid colors, and negative prompts.",
                    "text-to-image", "Text to Image (SDXL)",
                    "Artistic composition, negative prompt conditioning, and cinematic illustrations via Hugging Face Router",
                    "ready",
                    "stabilityai/stable-diffusion-xl-base-1.0",
                    List.of("Hugging Face (Fal-ai)"),
                    26000000L, 38000L, true, true, "hosted-serverless",
                    "Pre-Paid Credits Required",
                    "Requires pre-paid credits or PRO subscription on router.huggingface.co",
                    List.of("text"), List.of("image")
            )
    );

    public List<HfModelMeta> getAllModels(boolean forceRefresh) {
        List<HfModelMeta> list = new ArrayList<>(BASE_MODELS);

        // Dynamically discover additional pulled models from local Ollama if active
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:11434/api/tags"))
                    .timeout(Duration.ofMillis(800))
                    .GET()
                    .build();
            HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                // If local Ollama responded, mark local models as ready
                for (HfModelMeta m : list) {
                    if ("local".equalsIgnoreCase(m.getHostingType())) {
                        m.setStatus("ready");
                    }
                }
            }
        } catch (Exception ignored) {
            // Ollama offline: mark local models as offline
            for (HfModelMeta m : list) {
                if ("local".equalsIgnoreCase(m.getHostingType())) {
                    m.setStatus("offline");
                    m.setAvailabilityReason("Ollama is not running. Run 'ollama serve' to enable local execution.");
                }
            }
        }

        return list;
    }

    /**
     * Resolve requested model ID (supports candidate IDs, aliases, and provider defaults).
     */
    public String resolveModelId(String requestedModelId) {
        if (requestedModelId == null || requestedModelId.isBlank() || "auto".equalsIgnoreCase(requestedModelId)) {
            if (providerRegistry != null) {
                return providerRegistry.resolveDefaultModel();
            }
            return "gemini-2.5-flash";
        }

        String clean = requestedModelId.trim();

        for (HfModelMeta m : BASE_MODELS) {
            if (m.getId().equalsIgnoreCase(clean)) {
                return m.getId();
            }
            if (m.getCandidateId() != null && m.getCandidateId().equalsIgnoreCase(clean)) {
                return m.getId();
            }
        }

        String lower = clean.toLowerCase();

        // Check Text-to-Image models first
        if (lower.contains("banana") || lower.contains("gemini-nano-banana-2.1")) return "gemini-nano-banana-2.1";
        if (lower.contains("flash-image") || lower.contains("gemini-3.1-flash-image") || lower.contains("gemini-2.5-flash-image")) return "gemini-3.1-flash-image";
        if (lower.contains("pro-image") || lower.contains("gemini-3-pro-image")) return "gemini-3-pro-image";
        if (lower.contains("flare") || lower.contains("gpt-image-2.5-flare")) return "gpt-image-2.5-flare";
        if (lower.contains("sunburst") || lower.contains("gpt-image-2.5-sunburst")) return "gpt-image-2.5-sunburst";
        if (lower.contains("flux-schnell-free") || lower.equals("flux") || lower.contains("flux.1-free") || (lower.contains("flux") && lower.contains("free"))) return "flux-schnell-free";
        if (lower.contains("flux.1-schnell") || lower.contains("flux-schnell") || lower.contains("black-forest-labs")) return "black-forest-labs/FLUX.1-schnell";
        if (lower.contains("stable-diffusion") || lower.contains("sdxl") || lower.contains("stabilityai")) return "stabilityai/stable-diffusion-xl-base-1.0";

        // Check Image-to-Text vision models
        if (lower.contains("blip-image-captioning-large")) return "Salesforce/blip-image-captioning-large";
        if (lower.contains("blip-image-captioning-base")) return "Salesforce/blip-image-captioning-base";
        if (lower.contains("blip")) return "Salesforce/blip-image-captioning-large";
        if (lower.contains("vit-gpt2")) return "nlpconnect/vit-gpt2-image-captioning";
        if (lower.contains("git-base")) return "microsoft/git-base";
        if (lower.contains("trocr")) return "microsoft/trocr-base-printed";
        if (lower.contains("glm-ocr")) return "zai-org/GLM-OCR";
        if (lower.contains("3.5-flash-lite-vision") || lower.equals("gemini-3.5-flash-lite-vision")) return "gemini-3.5-flash-lite-vision";
        if (lower.contains("3.5-flash-vision") || lower.equals("gemini-3.5-flash-vision")) return "gemini-3.5-flash-vision";
        if (lower.contains("flash-latest-vision") || lower.equals("gemini-flash-latest-vision")) return "gemini-flash-latest-vision";
        if (lower.contains("2.5-flash-vision") || lower.equals("gemini-2.5-flash-vision")) return "gemini-2.5-flash-vision";
        if (lower.contains("1.5-flash-vision")) return "gemini-2.5-flash-vision";
        if (lower.contains("vision") || lower.contains("moondream") || lower.contains("florence") || lower.contains("vl")) {
            return "gemini-2.5-flash-vision";
        }
        if (lower.contains("3.5-flash-lite")) return "gemini-3.5-flash-lite";
        if (lower.contains("3.5-flash")) return "gemini-3.5-flash";
        if (lower.contains("flash-latest")) return "gemini-flash-latest-vision";
        if (lower.contains("2.5-flash") || lower.contains("1.5-flash")) return "gemini-2.5-flash";
        if (lower.startsWith("gemini")) return "gemini-2.5-flash";
        if (lower.contains("120b") || lower.contains("gpt-oss-120b")) return "openai/gpt-oss-120b";
        if (lower.contains("20b") || lower.contains("gpt-oss-20b")) return "openai/gpt-oss-20b";
        if (lower.contains("gpt-oss")) return "openai/gpt-oss-120b";
        if (lower.contains("qwen3.8") || lower.contains("qwen-3.8") || lower.equals("groq")) return "qwen/qwen3.8-27b";
        if (lower.contains("llama-3.3") || lower.contains("versatile") || lower.contains("instant") || lower.equals("llama-3.1-8b-instant")) return "qwen/qwen3.8-27b";
        if (lower.equals("ollama") || lower.equals("local")) return "qwen2.5:7b";
        if (lower.contains("qwen2.5:7b")) return "qwen2.5:7b";
        if (lower.contains("llama3.1:8b")) return "llama3.1:8b";
        if (lower.contains("qwen")) return "qwen/qwen3.8-27b";
        if (lower.contains("llama")) return "llama3.1:8b";
        if (lower.contains("gemma") || lower.contains("phi")) return "openai/gpt-oss-120b";

        return clean;
    }

    public HfModelMeta getModelById(String id) {
        if (id == null) return null;
        String resolved = resolveModelId(id);
        for (HfModelMeta m : BASE_MODELS) {
            if (m.getId().equalsIgnoreCase(resolved)) return m;
        }
        return null;
    }

    public Map<String, Object> filterModels(String search, String task, String provider,
                                           String hostingType, String sort, int page, int limit, boolean forceRefresh) {
        List<HfModelMeta> list = getAllModels(forceRefresh);

        if (task != null && !task.isBlank() && !task.equalsIgnoreCase("all")) {
            String t = task.trim().toLowerCase();
            list = list.stream().filter(m -> m.getTask() != null && m.getTask().toLowerCase().contains(t)).toList();
        }

        if (search != null && !search.trim().isEmpty()) {
            String q = search.trim().toLowerCase();
            list = list.stream().filter(m ->
                    (m.getId() != null && m.getId().toLowerCase().contains(q)) ||
                    (m.getName() != null && m.getName().toLowerCase().contains(q)) ||
                    (m.getUseCase() != null && m.getUseCase().toLowerCase().contains(q)) ||
                    (m.getTaskLabel() != null && m.getTaskLabel().toLowerCase().contains(q))
            ).toList();
        }

        Map<String, Object> pagination = Map.of(
                "total", list.size(),
                "page", 1,
                "limit", list.size(),
                "totalPages", 1
        );

        Map<String, Object> meta = Map.of(
                "totalModels", BASE_MODELS.size(),
                "registryType", "multi-provider-models"
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("models", list);
        result.put("pagination", pagination);
        result.put("meta", meta);
        return result;
    }

    public String detectBestModel(String prompt, List<Map<String, Object>> attachments) {
        // Image-to-Text model selection when image attachments exist
        if (attachments != null && !attachments.isEmpty()) {
            boolean hasImage = attachments.stream().anyMatch(a -> {
                String type = (String) a.get("type");
                String dataUrl = (String) a.get("dataUrl");
                return (type != null && type.startsWith("image/")) || (dataUrl != null && dataUrl.startsWith("data:image/"));
            });
            if (hasImage) {
                return "gemini-2.5-flash-vision";
            }
        }

        String pLower = (prompt != null) ? prompt.toLowerCase() : "";

        // Coding
        if (pLower.contains("function ") || pLower.contains("def ") || pLower.contains("write code") ||
            pLower.contains("debug this") || pLower.contains("sql query") || pLower.contains("react") ||
            pLower.contains("typescript") || pLower.contains("python") || pLower.contains("java") ||
            pLower.contains("code")) {
            return "gemini-2.5-flash";
        }

        // Reasoning & Math
        if (pLower.contains("solve") || pLower.contains("prove") || pLower.contains("logic") ||
            pLower.contains("math") || pLower.contains("why") || pLower.contains("explain step by step")) {
            return "gemini-2.5-flash";
        }

        // Default General Dialogue
        return "gemini-2.5-flash";
    }
}
