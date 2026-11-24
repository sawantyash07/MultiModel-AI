package com.coderarmy.ragsupport;

import org.springframework.ai.transformers.TransformersEmbeddingModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;

@Configuration
public class TransformersEmbeddingConfig {

    @Bean
    @Primary
    public TransformersEmbeddingModel transformersEmbeddingModel() {
        TransformersEmbeddingModel model = new TransformersEmbeddingModel();
        model.setTokenizerResource(new ClassPathResource("models/all-MiniLM-L6-v2/tokenizer.json"));
        model.setModelResource(new ClassPathResource("models/all-MiniLM-L6-v2/model.onnx"));
        model.setDisableCaching(true);
        return model;
    }
}
