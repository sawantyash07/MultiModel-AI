package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.WebSearchResult;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for executing live web research across multiple independent search engines
 * (DuckDuckGo, Wikipedia, Tavily, Serper) with caching, domain deduplication, and source credibility ranking.
 */
@Service
public class WebSearchService {

    private static final Logger log = LoggerFactory.getLogger(WebSearchService.class);

    @Value("${websearch.brave.api-key:${BRAVE_API_KEY:}}")
    private String braveApiKey;

    @Value("${websearch.tavily.api-key:${TAVILY_API_KEY:}}")
    private String tavilyApiKey;

    @Value("${websearch.serper.api-key:${SERPER_API_KEY:}}")
    private String serperApiKey;

    @Value("${websearch.cache.enabled:true}")
    private boolean cacheEnabled;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final Map<String, CachedSearchResult> searchCache = new ConcurrentHashMap<>();
    private final File cacheFile = new File("data/search_cache.json");
    private static final long CACHE_TTL_SECONDS = 3600; // 1 hour TTL

    private static final Pattern DDG_LINK_PATTERN = Pattern.compile(
            "<a[^>]+href=\"([^\"]+)\"[^>]*class='result-link'[^>]*>(.*?)</a>",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DDG_SNIPPET_PATTERN = Pattern.compile(
            "<td[^>]*class='result-snippet'[^>]*>(.*?)</td>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL
    );

    public WebSearchService() {
        loadCacheFromDisk();
    }

    private synchronized void loadCacheFromDisk() {
        try {
            if (cacheFile.exists()) {
                Map<String, CachedSearchResult> diskData = objectMapper.readValue(
                        cacheFile,
                        new TypeReference<Map<String, CachedSearchResult>>() {}
                );
                long now = Instant.now().getEpochSecond();
                diskData.forEach((k, v) -> {
                    if (now - v.timestamp < CACHE_TTL_SECONDS) {
                        searchCache.put(k, v);
                    }
                });
                log.info("[WebSearch] Loaded {} valid cached search queries from disk", searchCache.size());
            }
        } catch (Exception e) {
            log.warn("[WebSearch] Could not read search cache: {}", e.getMessage());
        }
    }

    private synchronized void saveCacheToDisk() {
        try {
            if (cacheFile.getParentFile() != null && !cacheFile.getParentFile().exists()) {
                cacheFile.getParentFile().mkdirs();
            }
            objectMapper.writeValue(cacheFile, searchCache);
        } catch (Exception e) {
            log.warn("[WebSearch] Could not persist search cache: {}", e.getMessage());
        }
    }

    /**
     * Executes web research for a query, cross-referencing multiple providers.
     */
    public List<WebSearchResult> search(String query, int maxResults) {
        if (query == null || query.isBlank()) {
            return Collections.emptyList();
        }

        String normalizedQuery = query.trim().replaceAll("\\s+", " ").toLowerCase();

        // 1. Check cache if enabled (bypass for freshness-sensitive queries)
        boolean isFreshQuery = normalizedQuery.contains("today") || normalizedQuery.contains("latest") || normalizedQuery.contains("current");
        if (cacheEnabled && !isFreshQuery && searchCache.containsKey(normalizedQuery)) {
            CachedSearchResult cached = searchCache.get(normalizedQuery);
            if (Instant.now().getEpochSecond() - cached.timestamp < CACHE_TTL_SECONDS) {
                log.info("[WebSearch] Serving {} cached research results for: '{}'", cached.results.size(), query);
                return cached.results;
            }
        }

        List<WebSearchResult> aggregated = new ArrayList<>();
        Set<String> seenDomains = new HashSet<>();

        // 2. Try Brave Search API if configured
        if (braveApiKey != null && !braveApiKey.isBlank()) {
            try {
                List<WebSearchResult> braveResults = searchBrave(query, maxResults);
                addDeduplicated(aggregated, braveResults, seenDomains);
            } catch (Exception e) {
                log.warn("[WebSearch] Brave Search provider error: {}", e.getMessage());
            }
        }

        // 3. Try Tavily API if configured
        if (aggregated.size() < maxResults && tavilyApiKey != null && !tavilyApiKey.isBlank()) {
            try {
                List<WebSearchResult> tavilyResults = searchTavily(query, maxResults);
                addDeduplicated(aggregated, tavilyResults, seenDomains);
            } catch (Exception e) {
                log.warn("[WebSearch] Tavily provider error: {}", e.getMessage());
            }
        }

        // 4. Try Serper API if configured
        if (serperApiKey != null && !serperApiKey.isBlank() && aggregated.size() < maxResults) {
            try {
                List<WebSearchResult> serperResults = searchSerper(query, maxResults);
                addDeduplicated(aggregated, serperResults, seenDomains);
            } catch (Exception e) {
                log.warn("[WebSearch] Serper provider error: {}", e.getMessage());
            }
        }

        // 4. Try Wikipedia for factual / entity / background verification
        if (aggregated.size() < maxResults) {
            try {
                List<WebSearchResult> wikiResults = searchWikipedia(query, 2);
                addDeduplicated(aggregated, wikiResults, seenDomains);
            } catch (Exception e) {
                log.warn("[WebSearch] Wikipedia search error: {}", e.getMessage());
            }
        }

        // 5. Try DuckDuckGo Lite (Primary open web provider)
        if (aggregated.size() < maxResults) {
            try {
                List<WebSearchResult> ddgResults = searchDuckDuckGoLite(query, maxResults);
                addDeduplicated(aggregated, ddgResults, seenDomains);
            } catch (Exception e) {
                log.warn("[WebSearch] DuckDuckGo provider error: {}", e.getMessage());
            }
        }

        // 6. Assign clean 1-based index numbers and sort by credibility score
        aggregated.sort((a, b) -> Double.compare(b.getCredibilityScore(), a.getCredibilityScore()));
        List<WebSearchResult> finalResults = new ArrayList<>();
        for (int i = 0; i < Math.min(aggregated.size(), maxResults); i++) {
            WebSearchResult item = aggregated.get(i);
            item.setIndex(i + 1);
            finalResults.add(item);
        }

        // 7. Save to cache
        if (cacheEnabled && !finalResults.isEmpty()) {
            searchCache.put(normalizedQuery, new CachedSearchResult(finalResults, Instant.now().getEpochSecond()));
            saveCacheToDisk();
        }

        log.info("[WebSearch] Completed live research for '{}' -> {} verified independent sources", query, finalResults.size());
        return finalResults;
    }

    private void addDeduplicated(List<WebSearchResult> target, List<WebSearchResult> source, Set<String> seenDomains) {
        if (source == null) return;
        for (WebSearchResult res : source) {
            String domain = res.getDomain();
            // Ensure independent sources from different domains
            if (!seenDomains.contains(domain) && !res.getUrl().isBlank()) {
                seenDomains.add(domain);
                target.add(res);
            }
        }
    }

    /**
     * DuckDuckGo Lite search scraping with clean HTML parsing.
     */
    private List<WebSearchResult> searchDuckDuckGoLite(String query, int limit) {
        List<WebSearchResult> results = new ArrayList<>();
        try {
            String postData = "q=" + URLEncoder.encode(query, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://lite.duckduckgo.com/lite/"))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                    .timeout(Duration.ofSeconds(6))
                    .POST(HttpRequest.BodyPublishers.ofString(postData))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                String html = response.body();

                Matcher linkMatcher = DDG_LINK_PATTERN.matcher(html);
                Matcher snippetMatcher = DDG_SNIPPET_PATTERN.matcher(html);

                int count = 0;
                while (linkMatcher.find() && snippetMatcher.find() && count < limit) {
                    String rawUrl = linkMatcher.group(1);
                    String rawTitle = linkMatcher.group(2).replaceAll("<[^>]+>", "").trim();
                    String rawSnippet = snippetMatcher.group(1).replaceAll("<[^>]+>", "").trim();

                    // Clean redirect URL if present
                    String resolvedUrl = resolveDuckDuckGoUrl(rawUrl);

                    if (!resolvedUrl.isBlank() && !rawTitle.isBlank()) {
                        String sourceType = determineSourceType(resolvedUrl);
                        WebSearchResult res = new WebSearchResult(count + 1, rawTitle, resolvedUrl, rawSnippet, sourceType);
                        results.add(res);
                        count++;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[WebSearch] DuckDuckGo search failed: {}", e.getMessage());
        }
        return results;
    }

    private String resolveDuckDuckGoUrl(String rawUrl) {
        if (rawUrl == null) return "";
        if (rawUrl.contains("uddg=")) {
            try {
                int start = rawUrl.indexOf("uddg=") + 5;
                int end = rawUrl.indexOf("&", start);
                String encoded = (end > start) ? rawUrl.substring(start, end) : rawUrl.substring(start);
                return URLDecoder.decode(encoded, StandardCharsets.UTF_8);
            } catch (Exception ignored) {}
        }
        return rawUrl.startsWith("//") ? "https:" + rawUrl : rawUrl;
    }

    /**
     * Wikipedia OpenSearch API.
     */
    private List<WebSearchResult> searchWikipedia(String query, int limit) {
        List<WebSearchResult> results = new ArrayList<>();
        try {
            String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String url = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encoded + "&utf8=&format=json";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "YashAI-ResearchBot/1.0 (academic-verification)")
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode searchArray = root.path("query").path("search");
                if (searchArray.isArray()) {
                    for (int i = 0; i < Math.min(searchArray.size(), limit); i++) {
                        JsonNode item = searchArray.get(i);
                        String title = item.path("title").asText("");
                        String snippet = item.path("snippet").asText("").replaceAll("<[^>]+>", "").trim();
                        String pageUrl = "https://en.wikipedia.org/wiki/" + URLEncoder.encode(title.replace(" ", "_"), StandardCharsets.UTF_8);

                        if (!title.isBlank()) {
                            results.add(new WebSearchResult(i + 1, title + " - Wikipedia", pageUrl, snippet, "ENCYCLOPEDIA"));
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[WebSearch] Wikipedia API call failed: {}", e.getMessage());
        }
        return results;
    }

    /**
     * Brave Search API integration.
     */
    private List<WebSearchResult> searchBrave(String query, int limit) {
        List<WebSearchResult> results = new ArrayList<>();
        try {
            String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String url = "https://api.search.brave.com/res/v1/web/search?q=" + encoded + "&count=" + Math.min(limit, 20);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Accept", "application/json")
                    .header("X-Subscription-Token", braveApiKey)
                    .timeout(Duration.ofSeconds(6))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode webResults = root.path("web").path("results");
                if (webResults.isArray()) {
                    for (int i = 0; i < Math.min(webResults.size(), limit); i++) {
                        JsonNode item = webResults.get(i);
                        String title = item.path("title").asText("");
                        String itemUrl = item.path("url").asText("");
                        String description = item.path("description").asText("");
                        String pageAge = item.path("page_age").asText("");

                        WebSearchResult res = new WebSearchResult(i + 1, title, itemUrl, description, determineSourceType(itemUrl));
                        if (pageAge != null && !pageAge.isBlank()) {
                            res.setPublishedDate(pageAge);
                        }
                        results.add(res);
                    }
                }
            } else {
                log.warn("[WebSearch] Brave Search returned HTTP {}", response.statusCode());
            }
        } catch (Exception e) {
            log.warn("[WebSearch] Brave Search API call failed: {}", e.getMessage());
        }
        return results;
    }

    /**
     * Tavily search API integration.
     */
    private List<WebSearchResult> searchTavily(String query, int limit) {
        List<WebSearchResult> results = new ArrayList<>();
        try {
            Map<String, Object> body = Map.of(
                    "api_key", tavilyApiKey,
                    "query", query,
                    "search_depth", "basic",
                    "max_results", limit
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.tavily.com/search"))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(6))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode resultsArray = root.path("results");
                if (resultsArray.isArray()) {
                    for (int i = 0; i < resultsArray.size(); i++) {
                        JsonNode item = resultsArray.get(i);
                        String title = item.path("title").asText("");
                        String url = item.path("url").asText("");
                        String content = item.path("content").asText("");
                        results.add(new WebSearchResult(i + 1, title, url, content, determineSourceType(url)));
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[WebSearch] Tavily API error: {}", e.getMessage());
        }
        return results;
    }

    /**
     * Serper search API integration.
     */
    private List<WebSearchResult> searchSerper(String query, int limit) {
        List<WebSearchResult> results = new ArrayList<>();
        try {
            Map<String, Object> body = Map.of("q", query, "num", limit);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://google.serper.dev/search"))
                    .header("X-API-KEY", serperApiKey)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(6))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode organic = root.path("organic");
                if (organic.isArray()) {
                    for (int i = 0; i < organic.size(); i++) {
                        JsonNode item = organic.get(i);
                        String title = item.path("title").asText("");
                        String link = item.path("link").asText("");
                        String snippet = item.path("snippet").asText("");
                        results.add(new WebSearchResult(i + 1, title, link, snippet, determineSourceType(link)));
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[WebSearch] Serper API error: {}", e.getMessage());
        }
        return results;
    }

    private String determineSourceType(String url) {
        String lower = url.toLowerCase();
        if (lower.contains("docs.") || lower.contains("/docs/") || lower.contains("documentation") ||
            lower.contains("developer.") || lower.contains("github.com") || lower.contains("spring.io") ||
            lower.contains("oracle.com") || lower.contains("python.org")) {
            return "OFFICIAL_DOCS";
        }
        if (lower.contains("wikipedia.org") || lower.contains("britannica.com")) {
            return "ENCYCLOPEDIA";
        }
        if (lower.contains(".edu") || lower.contains("arxiv.org") || lower.contains("sciencedirect.com")) {
            return "ACADEMIC";
        }
        if (lower.contains("reuters.com") || lower.contains("bloomberg.com") || lower.contains("bbc.com") || lower.contains("techcrunch.com")) {
            return "NEWS";
        }
        return "GENERAL";
    }

    public static class CachedSearchResult {
        public List<WebSearchResult> results;
        public long timestamp;

        public CachedSearchResult() {}

        public CachedSearchResult(List<WebSearchResult> results, long timestamp) {
            this.results = results;
            this.timestamp = timestamp;
        }
    }
}
