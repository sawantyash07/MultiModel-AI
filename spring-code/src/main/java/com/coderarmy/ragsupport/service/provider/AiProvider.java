package com.coderarmy.ragsupport.service.provider;

import org.springframework.http.codec.ServerSentEvent;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

/**
 * Universal interface for AI inference providers (Google Gemini, Local Ollama, Hugging Face, etc.).
 */
public interface AiProvider {

    /** Unique provider identifier, e.g. "gemini", "ollama", "huggingface" */
    String getProviderId();

    /** Human-readable display label, e.g. "Google Gemini (Free Hosted)", "Local Ollama" */
    String getDisplayName();

    /** Whether the provider has required credentials or configuration */
    boolean isConfigured();

    /** Live check of availability and reachability */
    boolean isAvailable();

    /** Descriptive status for health reporting */
    String getStatusDescription();

    /** Whether this provider supports or handles the given model identifier */
    boolean supportsModel(String modelId);

    /**
     * Executes real-time streaming chat completion.
     *
     * @param modelId Target model ID
     * @param messages List of role/content chat messages
     * @param startTime Timestamp when request originated
     * @param conversationId Active conversation identifier
     * @return Flux of ServerSentEvents for tokens, metadata, and termination
     */
    Flux<ServerSentEvent<String>> streamChat(
            String modelId,
            List<Map<String, Object>> messages,
            long startTime,
            String conversationId
    );

    /**
     * Executes real-time streaming chat completion with request correlation and cancellation tracking.
     *
     * @param modelId Target model ID
     * @param messages List of role/content chat messages
     * @param startTime Timestamp when request originated
     * @param conversationId Active conversation identifier
     * @param requestId Unique identifier for the generation request
     * @param messageId Unique assistant message ID
     * @return Flux of ServerSentEvents
     */
    default Flux<ServerSentEvent<String>> streamChat(
            String modelId,
            List<Map<String, Object>> messages,
            long startTime,
            String conversationId,
            String requestId,
            String messageId
    ) {
        return streamChat(modelId, messages, startTime, conversationId);
    }
}
