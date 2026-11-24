package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.MultimodalConceptExplanation;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class MultimodalConceptService {

    public MultimodalConceptExplanation getExplanation() {
        String title = "Multimodal AI: Vision Encoders, Patch Embeddings & Projection Adapters";
        
        String overview = "Multimodal AI models combine computer vision (CV) and natural language processing (NLP) " +
                "to understand and reason across text and image modalities simultaneously. " +
                "Instead of processing images as raw pixels, vision models break down images into sub-patches, " +
                "encode spatial features into dense vector embeddings, and project them into the same latent space used by LLMs.";

        List<Map<String, String>> pipelineSteps = List.of(
                Map.of(
                        "step", "1. RGB Pixel Representation & Normalization",
                        "description", "An input image of height H, width W, and 3 color channels (Red, Green, Blue) is represented as a 3D tensor I in R^(H x W x C). Pixels are normalized across channel means and standard deviations.",
                        "formula", "I_norm = (I - mu) / sigma"
                ),
                Map.of(
                        "step", "2. Image Patch Partitioning & Flattening",
                        "description", "The normalized image is divided into non-overlapping spatial patches of size (P x P) pixels (e.g. 16x16). The total number of patches N = (H*W) / (P*P). Each 2D patch is flattened into a 1D vector of length P*P*C (e.g. 16*16*3 = 768 dimensions).",
                        "formula", "N = (H / P) * (W / P),  x_patch in R^(N x (P^2 * C))"
                ),
                Map.of(
                        "step", "3. Linear Patch Projection & Positional Embeddings",
                        "description", "Each flattened patch vector is linearly projected onto a D-dimensional embedding space. Learnable 1D spatial position embeddings E_pos are added to retain spatial geometry across rows and columns.",
                        "formula", "z_0 = [x_patch_1 * E; x_patch_2 * E; ... ; x_patch_N * E] + E_pos"
                ),
                Map.of(
                        "step", "4. Vision Transformer (ViT) Encoder",
                        "description", "The patch token embeddings pass through L layers of Multi-Head Self-Attention (MHSA) and Layer Normalization (LN). The Vision Encoder extracts deep visual feature embeddings V_vis in R^(N x D_vision).",
                        "formula", "V_vis = ViT_Encoder(z_0)"
                ),
                Map.of(
                        "step", "5. Projection / Adapter Layer (Modality Alignment)",
                        "description", "Because the Vision Encoder embedding dimension (D_vision) may differ from the LLM embedding dimension (D_llm), a Projection Layer (e.g. MLP, Linear Layer, or Cross-Attention Perceiver) maps visual features directly into text token embedding space.",
                        "formula", "E_visual_tokens = W_proj * V_vis + b_proj  in R^(N x D_llm)"
                ),
                Map.of(
                        "step", "6. Multimodal LLM Cross-Attention & Text Generation",
                        "description", "The projected visual tokens E_visual_tokens are prepended or interleaved with textual prompt tokens E_text. The combined token sequence is processed by the autoregressive LLM Transformer layers to generate natural language answers.",
                        "formula", "Context_Tokens = [E_visual_tokens, E_text],  Output ~ LLM(Context_Tokens)"
                )
        );

        Map<String, String> architectureComponents = Map.of(
                "RGB Tensor Input", "Raw image pixel data (H x W x 3) normalized to [0,1] or standard ImageNet z-scores.",
                "Patch Splitter", "Divides 2D images into N fixed-size grid patches (e.g., 16x16 or 14x14).",
                "Vision Encoder (ViT/CLIP)", "Extracts high-level semantic visual features using self-attention over patches.",
                "Adapter Layer (MLP/Linear)", "Aligns visual dimensions (D_vision) to LLM textual token dimensions (D_llm).",
                "Multimodal LLM", "Processes visual and text embeddings in a unified transformer attention space to produce answers."
        );

        List<String> mathematicalFormulas = List.of(
                "N = (H * W) / (P * P)",
                "z_0 = [x_1 E; x_2 E; ...; x_N E] + E_pos",
                "E_vis_aligned = MLP_proj(ViT(z_0))",
                "P(y_t | y_<t, Image, Text) = Softmax(Transformer([E_vis_aligned, E_text]))"
        );

        return new MultimodalConceptExplanation(title, overview, pipelineSteps, architectureComponents, mathematicalFormulas);
    }
}
