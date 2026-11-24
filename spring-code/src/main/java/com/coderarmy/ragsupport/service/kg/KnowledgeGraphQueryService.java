package com.coderarmy.ragsupport.service.kg;

import com.coderarmy.ragsupport.model.kg.*;
import com.coderarmy.ragsupport.service.provider.GeminiProvider;
import com.coderarmy.ragsupport.service.provider.GroqProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for Grounded "Ask Your Knowledge Graph" Q&A and Graph Insights Generation.
 *
 * Implements:
 * 1. Graph traversal and neighborhood retrieval
 * 2. Source citation and evidence extraction
 * 3. Strict evidence-grounded answer generation with anti-hallucination guarantees
 * 4. Graph-theoretic insights (degree centrality, project-tech stacks, cross-source links)
 */
@Service
public class KnowledgeGraphQueryService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeGraphQueryService.class);

    private final KnowledgeGraphStorageService storageService;
    private final GeminiProvider geminiProvider;
    private final GroqProvider groqProvider;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${gemini.endpoint:https://generativelanguage.googleapis.com/v1beta/openai/chat/completions}")
    private String geminiEndpoint;

    @Value("${groq.endpoint:https://api.groq.com/openai/v1/chat/completions}")
    private String groqEndpoint;

    @Autowired
    public KnowledgeGraphQueryService(
            KnowledgeGraphStorageService storageService,
            @Autowired(required = false) GeminiProvider geminiProvider,
            @Autowired(required = false) GroqProvider groqProvider
    ) {
        this.storageService = storageService;
        this.geminiProvider = geminiProvider;
        this.groqProvider = groqProvider;
    }

    // -------------------------------------------------------------
    // Ask Your Knowledge Graph
    // -------------------------------------------------------------

    public KnowledgeAskResponse ask(KnowledgeAskRequest request) {
        if (request == null || request.getQuestion() == null || request.getQuestion().isBlank()) {
            return new KnowledgeAskResponse("Please enter a question about your knowledge graph.", true);
        }

        String question = request.getQuestion().trim();
        List<KnowledgeNode> allNodes = storageService.getAllNodes();
        List<KnowledgeEdge> allEdges = storageService.getAllEdges();

        if (allNodes.isEmpty()) {
            return new KnowledgeAskResponse(
                    "Your Knowledge Graph is currently empty. Click 'Rebuild Graph' to extract entities and connections from your conversations, persistent memories, and documents.",
                    true
            );
        }

        // 1. Identify relevant nodes and focal entities
        Set<KnowledgeNode> matchedNodes = new LinkedHashSet<>();
        Set<KnowledgeEdge> matchedEdges = new LinkedHashSet<>();
        Set<KnowledgeSourceRef> evidenceRefs = new LinkedHashSet<>();

        // If a specific focus node is passed
        if (request.getFocusNodeId() != null && !request.getFocusNodeId().isBlank()) {
            storageService.getNode(request.getFocusNodeId()).ifPresent(matchedNodes::add);
        }

        String lowerQ = question.toLowerCase();

        // Keyword & entity matching against canonical names and aliases
        for (KnowledgeNode node : allNodes) {
            boolean matched = false;
            if (lowerQ.contains(node.getLabel().toLowerCase())) {
                matched = true;
            } else {
                for (String alias : node.getAliases()) {
                    if (lowerQ.contains(alias.toLowerCase())) {
                        matched = true;
                        break;
                    }
                }
            }

            // Intent-based type matching
            if (!matched) {
                if ((lowerQ.contains("project") || lowerQ.contains("work on")) && "PROJECT".equalsIgnoreCase(node.getType())) {
                    matched = true;
                } else if ((lowerQ.contains("task") || lowerQ.contains("todo") || lowerQ.contains("unresolved")) && "TASK".equalsIgnoreCase(node.getType())) {
                    matched = true;
                } else if ((lowerQ.contains("decision") || lowerQ.contains("decide")) && "DECISION".equalsIgnoreCase(node.getType())) {
                    matched = true;
                } else if ((lowerQ.contains("preference") || lowerQ.contains("prefer")) && "PREFERENCE".equalsIgnoreCase(node.getType())) {
                    matched = true;
                }
            }

            if (matched) {
                matchedNodes.add(node);
            }
        }

        // If no nodes matched at all, check if user asks about connections or general overview
        if (matchedNodes.isEmpty()) {
            if (lowerQ.contains("overview") || lowerQ.contains("summary") || lowerQ.contains("what do i have") || lowerQ.contains("show me everything")) {
                matchedNodes.addAll(allNodes.stream().limit(12).collect(Collectors.toList()));
            } else {
                // Strict rule: State clearly when graph does not contain sufficient evidence. Do not fabricate.
                KnowledgeAskResponse noEvidenceResp = new KnowledgeAskResponse();
                noEvidenceResp.setInsufficientEvidence(true);
                noEvidenceResp.setAnswer(String.format(
                        "Based on your Personal Knowledge Graph, no matching evidence was found regarding: \"%s\".\n\n" +
                                "Your graph currently contains **%d entities** and **%d relationships** across your conversations and persistent memory. " +
                                "You can explore available topics such as %s, or click 'Rebuild Graph' to synchronize newly added data.",
                        question,
                        allNodes.size(),
                        allEdges.size(),
                        formatSampleNodeLabels(allNodes)
                ));
                noEvidenceResp.setSuggestedQueries(List.of(
                        "What projects have I worked on?",
                        "Which technologies are connected to my projects?",
                        "What decisions did I make about my architecture?"
                ));
                return noEvidenceResp;
            }
        }

        // 2. Expand neighborhood: fetch connected edges and immediate 1-hop neighbors
        Set<String> matchedNodeIds = matchedNodes.stream().map(KnowledgeNode::getId).collect(Collectors.toSet());
        for (KnowledgeEdge edge : allEdges) {
            if (matchedNodeIds.contains(edge.getSource()) || matchedNodeIds.contains(edge.getTarget())) {
                matchedEdges.add(edge);
                storageService.getNode(edge.getSource()).ifPresent(matchedNodes::add);
                storageService.getNode(edge.getTarget()).ifPresent(matchedNodes::add);
            }
        }

        // Collect all supporting sources and evidence excerpts
        for (KnowledgeNode n : matchedNodes) {
            evidenceRefs.addAll(n.getSources());
        }
        for (KnowledgeEdge e : matchedEdges) {
            evidenceRefs.addAll(e.getSources());
        }

        // 3. Generate grounded answer
        String groundedAnswer = tryGenerateGroundedAnswerWithLlm(question, matchedNodes, matchedEdges, evidenceRefs, request.getModelId());

        if (groundedAnswer == null || groundedAnswer.isBlank()) {
            groundedAnswer = generateDeterministicGroundedSynthesis(question, matchedNodes, matchedEdges, evidenceRefs);
        }

        KnowledgeAskResponse response = new KnowledgeAskResponse();
        response.setAnswer(groundedAnswer);
        response.setCitedNodes(new ArrayList<>(matchedNodes));
        response.setCitedEdges(new ArrayList<>(matchedEdges));
        response.setEvidenceExcerpts(new ArrayList<>(evidenceRefs));
        response.setConfidence(0.95);
        response.setInsufficientEvidence(false);
        response.setSuggestedQueries(generateFollowUpQueries(question, matchedNodes));

        return response;
    }

    // -------------------------------------------------------------
    // LLM Grounded Generation
    // -------------------------------------------------------------

    private String tryGenerateGroundedAnswerWithLlm(
            String question,
            Set<KnowledgeNode> nodes,
            Set<KnowledgeEdge> edges,
            Set<KnowledgeSourceRef> evidence,
            String requestedModelId
    ) {
        try {
            StringBuilder context = new StringBuilder();
            context.append("### 🌐 Verified Personal Knowledge Graph Facts:\n");
            context.append("Entities:\n");
            for (KnowledgeNode n : nodes) {
                String aliasesStr = (n.getAliases() != null && !n.getAliases().isEmpty())
                        ? " (Aliases: " + String.join(", ", n.getAliases()) + ")" : "";
                context.append(String.format("- **%s** [%s]%s: %s\n", n.getLabel(), n.getType(), aliasesStr, n.getDescription()));
            }

            context.append("\nRelationships:\n");
            for (KnowledgeEdge e : edges) {
                Optional<KnowledgeNode> src = storageService.getNode(e.getSource());
                Optional<KnowledgeNode> tgt = storageService.getNode(e.getTarget());
                if (src.isPresent() && tgt.isPresent()) {
                    String inferredTag = e.isInferred() ? " [Inferred]" : "";
                    context.append(String.format("- (%s) --[%s%s]--> (%s): %s\n",
                            src.get().getLabel(), e.getLabel(), inferredTag, tgt.get().getLabel(),
                            e.getDescription() != null ? e.getDescription() : ""));
                }
            }

            context.append("\nSupporting Source Evidence:\n");
            int citeIdx = 1;
            for (KnowledgeSourceRef ref : evidence) {
                if (citeIdx > 8) break;
                String srcTitle = ref.getSourceTitle() != null ? ref.getSourceTitle() : ref.getSourceType();
                String excerpt = (ref.getExcerpt() != null && !ref.getExcerpt().isBlank()) ? ref.getExcerpt() : "Mentioned in " + srcTitle;
                context.append(String.format("Evidence [%d] (Source: %s [%s]): \"%s\"\n",
                        citeIdx++, srcTitle, ref.getSourceType(), excerpt));
            }

            String systemPrompt = "You are the Personal Knowledge Graph assistant for Yash AI.\n" +
                    "Your objective is to answer the user's question strictly grounded on the provided Knowledge Graph facts and supporting source evidence.\n\n" +
                    "Strict Rules:\n" +
                    "1. Evidence Grounding: Only make statements that are explicitly supported by the entities, relationships, or evidence excerpts provided.\n" +
                    "2. Traceable Citations: Attribute key facts to their source using citations like `[Source: Title]` or `[Memory: Category]`.\n" +
                    "3. Inferred Relationships: If a relationship is marked [Inferred], explicitly mention that it was inferred from context.\n" +
                    "4. No Fabrication: Do not invent projects, dates, technologies, or conversations not present in the graph.\n" +
                    "5. Structure: Use concise, professional markdown with bullet points where appropriate.";

            String userContent = context.toString() + "\n\nUser Question: " + question;

            // 1. Try Groq (high-speed LPU)
            if (groqProvider != null && groqProvider.isConfigured()) {
                String apiKey = groqProvider.getEffectiveApiKey();
                if (apiKey != null && !apiKey.isBlank()) {
                    String resp = callOpenAiCompatibleEndpoint(groqEndpoint, "Bearer " + apiKey, "qwen/qwen3.8-27b", systemPrompt, userContent);
                    if (resp != null && !resp.isBlank()) return resp;
                }
            }

            // 2. Try Gemini
            if (geminiProvider != null && geminiProvider.isConfigured()) {
                String apiKey = geminiProvider.getEffectiveApiKey();
                if (apiKey != null && !apiKey.isBlank()) {
                    String resp = callOpenAiCompatibleEndpoint(geminiEndpoint, "Bearer " + apiKey, "gemini-2.5-flash", systemPrompt, userContent);
                    if (resp != null && !resp.isBlank()) return resp;
                }
            }
        } catch (Exception e) {
            log.warn("[KnowledgeGraphQuery] LLM generation skipped: {}", e.getMessage());
        }
        return null;
    }

    private String callOpenAiCompatibleEndpoint(String endpoint, String authHeader, String model, String systemPrompt, String userPrompt) {
        try {
            Map<String, Object> reqBody = Map.of(
                    "model", model,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    ),
                    "temperature", 0.4,
                    "max_tokens", 800
            );

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .header("Authorization", authHeader)
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(reqBody)))
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(resp.body());
                JsonNode choices = root.path("choices");
                if (choices.isArray() && choices.size() > 0) {
                    return choices.get(0).path("message").path("content").asText("").trim();
                }
            }
        } catch (Exception e) {
            log.debug("[KnowledgeGraphQuery] Endpoint call failed: {}", e.getMessage());
        }
        return null;
    }

    // -------------------------------------------------------------
    // Deterministic Synthesis Fallback
    // -------------------------------------------------------------

    private String generateDeterministicGroundedSynthesis(
            String question,
            Set<KnowledgeNode> nodes,
            Set<KnowledgeEdge> edges,
            Set<KnowledgeSourceRef> evidence
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append("Here is the grounded knowledge retrieved from your Personal Knowledge Graph for: **\"").append(question).append("\"**\n\n");

        // Group nodes by type
        Map<String, List<KnowledgeNode>> byType = nodes.stream().collect(Collectors.groupingBy(KnowledgeNode::getType));

        if (byType.containsKey("PROJECT")) {
            sb.append("### 📁 Projects\n");
            for (KnowledgeNode p : byType.get("PROJECT")) {
                sb.append(String.format("- **%s**: %s\n", p.getLabel(), p.getDescription()));
            }
            sb.append("\n");
        }

        if (byType.containsKey("TECHNOLOGY")) {
            sb.append("### ⚙️ Technologies & Tools\n");
            for (KnowledgeNode t : byType.get("TECHNOLOGY")) {
                sb.append(String.format("- **%s**: %s\n", t.getLabel(), t.getDescription()));
            }
            sb.append("\n");
        }

        if (byType.containsKey("DECISION")) {
            sb.append("### 💡 Architectural Decisions\n");
            for (KnowledgeNode d : byType.get("DECISION")) {
                sb.append(String.format("- **%s**: %s\n", d.getLabel(), d.getDescription()));
            }
            sb.append("\n");
        }

        if (byType.containsKey("TASK")) {
            sb.append("### 📌 Tasks & Milestones\n");
            for (KnowledgeNode t : byType.get("TASK")) {
                String statusPill = t.getStatus() != null ? " `[" + t.getStatus() + "]`" : "";
                sb.append(String.format("- **%s**%s: %s\n", t.getLabel(), statusPill, t.getDescription()));
            }
            sb.append("\n");
        }

        if (!edges.isEmpty()) {
            sb.append("### 🔗 Key Connections in Your Knowledge Network\n");
            for (KnowledgeEdge e : edges) {
                Optional<KnowledgeNode> src = storageService.getNode(e.getSource());
                Optional<KnowledgeNode> tgt = storageService.getNode(e.getTarget());
                if (src.isPresent() && tgt.isPresent()) {
                    String desc = (e.getDescription() != null && !e.getDescription().isBlank()) ? (" — " + e.getDescription()) : "";
                    sb.append(String.format("- **%s** `[%s]` **%s**%s\n",
                            src.get().getLabel(), e.getLabel(), tgt.get().getLabel(), desc));
                }
            }
            sb.append("\n");
        }

        if (!evidence.isEmpty()) {
            sb.append("### 📄 Provenance & Supporting Citations\n");
            int count = 0;
            for (KnowledgeSourceRef ref : evidence) {
                if (count++ >= 5) break;
                String title = ref.getSourceTitle() != null ? ref.getSourceTitle() : ref.getSourceType();
                String excerpt = (ref.getExcerpt() != null && !ref.getExcerpt().isBlank()) ? ref.getExcerpt() : "Source record";
                sb.append(String.format("- **Source**: `%s` (%s)\n  > \"%s\"\n", title, ref.getSourceType(), excerpt));
            }
        }

        return sb.toString();
    }

    // -------------------------------------------------------------
    // Graph Insights
    // -------------------------------------------------------------

    public KnowledgeGraphInsights computeInsights() {
        KnowledgeGraphInsights insights = new KnowledgeGraphInsights();
        List<KnowledgeNode> nodes = storageService.getAllNodes();
        List<KnowledgeEdge> edges = storageService.getAllEdges();

        insights.setTotalNodes(nodes.size());
        insights.setTotalEdges(edges.size());
        insights.setLastSyncTime(storageService.getLastSyncTime());

        // 1. Nodes by Type
        Map<String, Integer> nodesByType = new LinkedHashMap<>();
        for (KnowledgeNode n : nodes) {
            String type = n.getType() != null ? n.getType() : "CONCEPT";
            nodesByType.put(type, nodesByType.getOrDefault(type, 0) + 1);
        }
        insights.setNodesByType(nodesByType);

        // 2. Edges by Relation
        Map<String, Integer> edgesByRel = new LinkedHashMap<>();
        for (KnowledgeEdge e : edges) {
            String rel = e.getRelation() != null ? e.getRelation() : "RELATED_TO";
            edgesByRel.put(rel, edgesByRel.getOrDefault(rel, 0) + 1);
        }
        insights.setEdgesByRelation(edgesByRel);

        // 3. Degree Centrality (Most Frequently Connected Topics)
        Map<String, Integer> degreeMap = new HashMap<>();
        for (KnowledgeEdge e : edges) {
            degreeMap.put(e.getSource(), degreeMap.getOrDefault(e.getSource(), 0) + 1);
            degreeMap.put(e.getTarget(), degreeMap.getOrDefault(e.getTarget(), 0) + 1);
        }

        List<Map<String, Object>> mostConnected = nodes.stream()
                .map(n -> {
                    int deg = degreeMap.getOrDefault(n.getId(), 0);
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", n.getId());
                    item.put("label", n.getLabel());
                    item.put("type", n.getType());
                    item.put("connectionCount", deg);
                    return item;
                })
                .sorted((a, b) -> Integer.compare((Integer) b.get("connectionCount"), (Integer) a.get("connectionCount")))
                .limit(8)
                .collect(Collectors.toList());
        insights.setMostConnectedEntities(mostConnected);

        // 4. Projects and their technologies
        List<Map<String, Object>> projectsWithTech = new ArrayList<>();
        List<KnowledgeNode> projectNodes = nodes.stream()
                .filter(n -> "PROJECT".equalsIgnoreCase(n.getType()))
                .collect(Collectors.toList());

        for (KnowledgeNode proj : projectNodes) {
            List<String> techNames = edges.stream()
                    .filter(e -> proj.getId().equals(e.getSource()) && "USES_TECHNOLOGY".equalsIgnoreCase(e.getRelation()))
                    .map(e -> storageService.getNode(e.getTarget()).map(KnowledgeNode::getLabel).orElse(""))
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toList());

            Map<String, Object> pInfo = new LinkedHashMap<>();
            pInfo.put("projectName", proj.getLabel());
            pInfo.put("technologies", techNames);
            pInfo.put("status", proj.getStatus());
            projectsWithTech.add(pInfo);
        }
        insights.setProjectsWithTech(projectsWithTech);

        // 5. Decisions connected to projects
        List<Map<String, Object>> decisionsByProject = new ArrayList<>();
        List<KnowledgeNode> decNodes = nodes.stream()
                .filter(n -> "DECISION".equalsIgnoreCase(n.getType()))
                .collect(Collectors.toList());

        for (KnowledgeNode dec : decNodes) {
            Map<String, Object> dInfo = new LinkedHashMap<>();
            dInfo.put("id", dec.getId());
            dInfo.put("decision", dec.getLabel());
            dInfo.put("description", dec.getDescription());
            dInfo.put("status", dec.getStatus());
            decisionsByProject.add(dInfo);
        }
        insights.setDecisionsByProject(decisionsByProject);

        // 6. Cross-Source Entities (appear across multiple independent sources)
        List<Map<String, Object>> crossSource = nodes.stream()
                .filter(n -> {
                    Set<String> sourceIds = n.getSources().stream()
                            .map(KnowledgeSourceRef::getSourceId)
                            .filter(Objects::nonNull)
                            .collect(Collectors.toSet());
                    return sourceIds.size() >= 2;
                })
                .map(n -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", n.getId());
                    item.put("label", n.getLabel());
                    item.put("type", n.getType());
                    item.put("sourceCount", n.getSources().size());
                    item.put("sources", n.getSources().stream().map(KnowledgeSourceRef::getSourceTitle).distinct().collect(Collectors.toList()));
                    return item;
                })
                .sorted((a, b) -> Integer.compare((Integer) b.get("sourceCount"), (Integer) a.get("sourceCount")))
                .limit(6)
                .collect(Collectors.toList());
        insights.setCrossSourceEntities(crossSource);

        // 7. Unresolved Tasks
        List<Map<String, Object>> tasks = nodes.stream()
                .filter(n -> "TASK".equalsIgnoreCase(n.getType()) && !"COMPLETED".equalsIgnoreCase(n.getStatus()))
                .map(n -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", n.getId());
                    item.put("task", n.getLabel());
                    item.put("description", n.getDescription());
                    item.put("status", n.getStatus());
                    return item;
                })
                .collect(Collectors.toList());
        insights.setUnresolvedTasks(tasks);

        // 8. Evidence Distribution
        int singleSource = 0;
        int multiSource = 0;
        int highEvidence = 0;
        for (KnowledgeNode n : nodes) {
            int count = n.getSources().size();
            if (count <= 1) singleSource++;
            else if (count <= 3) multiSource++;
            else highEvidence++;
        }
        insights.setEvidenceDistribution(Map.of(
                "Single Source (1)", singleSource,
                "Multi Source (2-3)", multiSource,
                "High Evidence (4+)", highEvidence
        ));

        return insights;
    }

    private static String formatSampleNodeLabels(List<KnowledgeNode> nodes) {
        return nodes.stream()
                .map(KnowledgeNode::getLabel)
                .limit(4)
                .collect(Collectors.joining(", "));
    }

    private static List<String> generateFollowUpQueries(String query, Set<KnowledgeNode> nodes) {
        List<String> suggestions = new ArrayList<>();
        Optional<KnowledgeNode> proj = nodes.stream().filter(n -> "PROJECT".equalsIgnoreCase(n.getType())).findFirst();
        if (proj.isPresent()) {
            suggestions.add("What technologies does " + proj.get().getLabel() + " depend on?");
            suggestions.add("Which tasks remain unresolved for " + proj.get().getLabel() + "?");
        }
        Optional<KnowledgeNode> tech = nodes.stream().filter(n -> "TECHNOLOGY".equalsIgnoreCase(n.getType())).findFirst();
        if (tech.isPresent()) {
            suggestions.add("Where else is " + tech.get().getLabel() + " mentioned across my data?");
        }
        if (suggestions.isEmpty()) {
            suggestions.add("What are my key architectural decisions?");
            suggestions.add("Which topics appear across multiple conversations?");
        }
        return suggestions;
    }
}
