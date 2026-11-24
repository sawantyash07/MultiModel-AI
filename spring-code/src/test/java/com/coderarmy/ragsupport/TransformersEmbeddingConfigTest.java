package com.coderarmy.ragsupport;

import org.junit.jupiter.api.Test;
import org.springframework.ai.transformers.TransformersEmbeddingModel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TransformersEmbeddingConfigTest {

    @Test
    void testTransformersEmbeddingModelLocalInitialization() throws Exception {
        TransformersEmbeddingConfig config = new TransformersEmbeddingConfig();
        try (TransformersEmbeddingModel model = config.transformersEmbeddingModel()) {
            model.afterPropertiesSet();

            float[] embedding = model.embed("What is the return policy?");
            assertNotNull(embedding, "Embedding result should not be null");
            assertEquals(384, embedding.length, "all-MiniLM-L6-v2 embedding dimension should be 384");
            assertTrue(model.dimensions() == 384 || model.dimensions() == 0, "Dimensions check");
        }
    }
}
