package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.ResearchVerificationResult;
import com.coderarmy.ragsupport.model.WebSearchResult;
import com.coderarmy.ragsupport.service.FactVerificationService;
import com.coderarmy.ragsupport.service.WebSearchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller exposing live internet research and fact verification endpoints.
 */
@RestController
@RequestMapping("/api/research")
@CrossOrigin(origins = "*")
public class ResearchController {

    private final WebSearchService webSearchService;
    private final FactVerificationService factVerificationService;

    public ResearchController(WebSearchService webSearchService, FactVerificationService factVerificationService) {
        this.webSearchService = webSearchService;
        this.factVerificationService = factVerificationService;
    }

    /**
     * POST /api/research/search
     * Executes live web research and returns verified sources with credibility scores.
     */
    @PostMapping("/search")
    public ResponseEntity<Map<String, Object>> searchWeb(@RequestBody Map<String, Object> body) {
        String query = (String) body.getOrDefault("query", "");
        int max = body.containsKey("limit") ? ((Number) body.get("limit")).intValue() : 4;

        List<WebSearchResult> results = webSearchService.search(query, max);
        return ResponseEntity.ok(Map.of(
                "query", query,
                "count", results.size(),
                "sources", results
        ));
    }

    /**
     * POST /api/research/verify
     * Evaluates query, cross-checks sources, and generates evidence brief.
     */
    @PostMapping("/verify")
    public ResponseEntity<ResearchVerificationResult> verifyFacts(@RequestBody Map<String, Object> body) {
        String query = (String) body.getOrDefault("query", "");
        ResearchVerificationResult result = factVerificationService.verifyAndCollectEvidence(query);
        return ResponseEntity.ok(result);
    }
}
