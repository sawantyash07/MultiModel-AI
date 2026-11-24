package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.ResearchVerificationResult;
import com.coderarmy.ragsupport.model.WebSearchResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Service for evaluating user queries, detecting factual research intent,
 * verifying entity existence, cross-checking independent evidence, and preventing hallucinations.
 */
@Service
public class FactVerificationService {

    private static final Logger log = LoggerFactory.getLogger(FactVerificationService.class);

    private final WebSearchService webSearchService;

    // Patterns indicating queries that do NOT need web search
    private static final Pattern CREATIVE_PATTERN = Pattern.compile(
            "(?i)^(write|create|compose|tell|invent)\\s+(a|an)?\\s*(poem|joke|fictional|story|rhyme|song|haiku|fairy tale|riddle)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern CALC_PATTERN = Pattern.compile(
            "(?i)^(calculate|solve|what is|compute)?\\s*(\\d+[\\s+\\-*/^%]+\\d+)+",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern GREETING_PATTERN = Pattern.compile(
            "(?i)^(hi|hello|hey|greetings|good\\s+(morning|afternoon|evening)|how\\s+are\\s+you|who\\s+are\\s+you|what\\s+is\\s+your\\s+name)[.!?]?$",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern EXPLICIT_WEB_SEARCH_PATTERN = Pattern.compile(
            "(?i)(?:search\\s+(?:the\\s+)?(?:web|internet|online)|google\\s+(?:this|it)|live\\s+(?:news|updates|score|price)|current\\s+(?:weather|price|stock|crypto|exchange\\s+rate)|today'?s\\s+news|breaking\\s+news|latest\\s+news\\s+about)",
            Pattern.CASE_INSENSITIVE
    );

    // Patterns indicating explicit factual / external research intent
    private static final Pattern FACTUAL_INTENT_PATTERN = Pattern.compile(
            "(?i)(latest\\s+(?:release|version|news|update)|breaking\\s+news|stock\\s+price|crypto\\s+price|current\\s+weather|is\\s+[a-z0-9_-]+\\s+(real|a real|exist)|does\\s+[a-z0-9_-]+\\s+exist)",
            Pattern.CASE_INSENSITIVE
    );

    public FactVerificationService(WebSearchService webSearchService) {
        this.webSearchService = webSearchService;
    }

    /**
     * Determines whether a query requires live web research, supporting automatic detection or user override.
     */
    public boolean requiresWebSearch(String prompt, List<Map<String, Object>> attachments) {
        return requiresWebSearch(prompt, attachments, null);
    }

    public boolean requiresWebSearch(String prompt, List<Map<String, Object>> attachments, Boolean userWebSearchOverride) {
        if (Boolean.TRUE.equals(userWebSearchOverride)) return true;
        if (Boolean.FALSE.equals(userWebSearchOverride)) return false;

        if (prompt == null || prompt.isBlank()) return false;
        String clean = prompt.trim();

        // 1. If attachments are provided (images or documents), query is visual or document QA, skip web search
        if (attachments != null && !attachments.isEmpty()) {
            boolean hasImageOrDoc = attachments.stream().anyMatch(a -> {
                String type = (String) a.get("type");
                String dataUrl = (String) a.get("dataUrl");
                return (type != null && (type.startsWith("image/") || type.contains("pdf"))) ||
                        (dataUrl != null && dataUrl.startsWith("data:image/"));
            });
            if (hasImageOrDoc && !EXPLICIT_WEB_SEARCH_PATTERN.matcher(clean).find()) {
                return false;
            }
        }

        // 2. Creative tasks
        if (CREATIVE_PATTERN.matcher(clean).find()) return false;

        // 3. Simple calculations
        if (CALC_PATTERN.matcher(clean).matches()) return false;

        // 4. Greetings
        if (GREETING_PATTERN.matcher(clean).matches()) return false;

        // 5. Code translation / syntax explanation / coding tasks
        if (clean.toLowerCase().startsWith("convert this") || clean.toLowerCase().startsWith("format this")
                || clean.toLowerCase().startsWith("write a") || clean.toLowerCase().startsWith("implement a")
                || clean.toLowerCase().startsWith("solve") || clean.toLowerCase().startsWith("fix this")
                || clean.toLowerCase().startsWith("debug")) {
            return false;
        }

        // 6. Explicit live web search requested in prompt
        if (EXPLICIT_WEB_SEARCH_PATTERN.matcher(clean).find()) return true;

        // 7. Real-time news or specific existence check
        if (FACTUAL_INTENT_PATTERN.matcher(clean).find()) return true;

        return false;
    }

    /**
     * Executes web research, cross-checks independent evidence, and prepares verification context.
     */
    public ResearchVerificationResult verifyAndCollectEvidence(String userPrompt) {
        ResearchVerificationResult result = new ResearchVerificationResult();
        result.setQuery(userPrompt);
        result.setNeededSearch(true);

        log.info("[FactVerification] Executing live web research for: '{}'", userPrompt);
        List<WebSearchResult> sources = webSearchService.search(userPrompt, 4);

        result.setSearchPerformed(true);
        result.setSources(sources);
        result.setSourcesFound(!sources.isEmpty());

        if (sources.isEmpty()) {
            result.setEntityVerified(false);
            result.setWarningNotice("Live web research could not independently verify this query because the search provider returned no credible sources.");
            return result;
        }

        // Check if entity appears non-existent (e.g. asking about fabricated names)
        Set<String> stopWords = Set.of(
                "about", "launch", "specs", "specifications", "details", "features", "explain",
                "information", "price", "history", "device", "service", "system", "model",
                "version", "which", "where", "what", "would", "could", "should", "please",
                "tell", "when", "does", "that", "with", "from", "their", "there", "these",
                "those", "released", "release", "created", "company", "person", "product",
                "build", "using", "latest", "official", "guide", "overview", "documentation",
                "write", "create"
        );

        List<String> distinctiveWords = new ArrayList<>();
        String[] words = userPrompt.toLowerCase().replaceAll("[^a-z0-9\\s]", " ").split("\\s+");
        for (String w : words) {
            if (w.length() >= 4 && !stopWords.contains(w)) {
                distinctiveWords.add(w);
            }
        }

        int matchedWords = 0;
        if (!distinctiveWords.isEmpty()) {
            for (String w : distinctiveWords) {
                boolean wordFound = false;
                for (WebSearchResult s : sources) {
                    String titleLower = (s.getTitle() != null) ? s.getTitle().toLowerCase() : "";
                    String snippetLower = (s.getSnippet() != null) ? s.getSnippet().toLowerCase() : "";
                    if (titleLower.contains(w) || snippetLower.contains(w)) {
                        wordFound = true;
                        break;
                    }
                }
                if (wordFound) {
                    matchedWords++;
                }
            }
        }

        double matchRatio = distinctiveWords.isEmpty() ? 1.0 : ((double) matchedWords / distinctiveWords.size());
        boolean hasEntityClues = matchRatio >= 0.5;

        result.setEntityVerified(hasEntityClues);
        if (!hasEntityClues) {
            result.setWarningNotice("The entity or subject could not be confirmed in credible web research.");
        }

        // Build clean evidence brief
        StringBuilder brief = new StringBuilder();
        brief.append("### Verified Evidence Retrieved From Live Internet Sources:\n\n");

        for (WebSearchResult s : sources) {
            brief.append(String.format("Source [%d]: %s (%s)\n", s.getIndex(), s.getTitle(), s.getUrl()));
            String pub = (s.getPublishedDate() != null && !s.getPublishedDate().isBlank()) ? (" | Published: " + s.getPublishedDate()) : "";
            brief.append(String.format("Domain: %s | Credibility: %.2f | Type: %s%s\n", s.getDomain(), s.getCredibilityScore(), s.getSourceType(), pub));
            if (s.getSnippet() != null && !s.getSnippet().isBlank()) {
                brief.append(String.format("Evidence Snippet: \"%s\"\n", s.getSnippet().replace("\n", " ").trim()));
            }
            brief.append("\n");
        }

        result.setEvidenceBrief(brief.toString());
        return result;
    }
}
