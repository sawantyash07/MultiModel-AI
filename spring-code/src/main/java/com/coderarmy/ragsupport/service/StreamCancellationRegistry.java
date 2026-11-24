package com.coderarmy.ragsupport.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Thread-safe registry that maps active generation request IDs to upstream cancellation hooks.
 * Enables immediate cancellation of in-flight LLM requests across network boundaries.
 */
@Component
public class StreamCancellationRegistry {

    private static final Logger log = LoggerFactory.getLogger(StreamCancellationRegistry.class);

    private final ConcurrentMap<String, Runnable> activeCancellers = new ConcurrentHashMap<>();

    /**
     * Registers a cancellation callback for a specific generation request.
     */
    public void register(String requestId, Runnable canceller) {
        if (requestId != null && !requestId.isBlank() && canceller != null) {
            activeCancellers.put(requestId, canceller);
            log.debug("[Cancellation Registry] Registered canceller for request: {}", requestId);
        }
    }

    /**
     * Unregisters a cancellation callback when a stream terminates normally.
     */
    public void unregister(String requestId) {
        if (requestId != null && !requestId.isBlank()) {
            activeCancellers.remove(requestId);
            log.debug("[Cancellation Registry] Unregistered canceller for request: {}", requestId);
        }
    }

    /**
     * Cancels an active generation request immediately.
     *
     * @param requestId The generation request ID
     * @return true if an active stream was found and cancelled, false otherwise
     */
    public boolean cancel(String requestId) {
        if (requestId == null || requestId.isBlank()) return false;
        Runnable canceller = activeCancellers.remove(requestId);
        if (canceller != null) {
            try {
                log.info("[Cancellation Registry] Triggering cancellation for request: {}", requestId);
                canceller.run();
                return true;
            } catch (Exception e) {
                log.warn("[Cancellation Registry] Error running canceller for request '{}': {}", requestId, e.getMessage());
            }
        }
        return false;
    }

    /**
     * Checks if a request has an active stream registered.
     */
    public boolean isActive(String requestId) {
        return requestId != null && activeCancellers.containsKey(requestId);
    }
}
