package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.kg.KnowledgeEdge;
import com.coderarmy.ragsupport.model.kg.KnowledgeNode;
import com.coderarmy.ragsupport.service.ConversationStorageService;
import com.coderarmy.ragsupport.service.DocumentIntelligenceService;
import com.coderarmy.ragsupport.service.UserMemoryService;
import com.coderarmy.ragsupport.service.kg.KnowledgeExtractionPipeline;
import com.coderarmy.ragsupport.service.kg.KnowledgeGraphQueryService;
import com.coderarmy.ragsupport.service.kg.KnowledgeGraphStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

public class KnowledgeGraphControllerTest {

    private MockMvc mockMvc;
    private KnowledgeGraphStorageService storageService;
    private KnowledgeExtractionPipeline extractionPipeline;
    private KnowledgeGraphQueryService queryService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    public void setup() {
        storageService = new KnowledgeGraphStorageService();
        storageService.clearAll();

        extractionPipeline = new KnowledgeExtractionPipeline(
                storageService,
                new ConversationStorageService(),
                new UserMemoryService(),
                new DocumentIntelligenceService(),
                null,
                null
        );

        queryService = new KnowledgeGraphQueryService(storageService, null, null);

        KnowledgeGraphController controller = new KnowledgeGraphController(storageService, extractionPipeline, queryService);
        this.mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    public void testGetGraphEndpoint() throws Exception {
        KnowledgeNode n1 = new KnowledgeNode("node-1", "PROJECT", "E-Commerce", "Ecom project");
        storageService.addOrUpdateNode(n1);

        mockMvc.perform(get("/api/knowledge-graph"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nodes", hasSize(1)))
                .andExpect(jsonPath("$.nodes[0].label", is("E-Commerce")));
    }

    @Test
    public void testCreateUpdateDeleteNode() throws Exception {
        // 1. Create Node
        KnowledgeNode newNode = new KnowledgeNode();
        newNode.setLabel("ClickHouse Database");
        newNode.setType("TECHNOLOGY");
        newNode.setDescription("Columnar real-time SQL DB");
        newNode.setAliases(List.of("Clickhouse"));

        String res = mockMvc.perform(post("/api/knowledge-graph/nodes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newNode)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.label", is("ClickHouse Database")))
                .andReturn().getResponse().getContentAsString();

        KnowledgeNode created = objectMapper.readValue(res, KnowledgeNode.class);

        // 2. Get Node Details
        mockMvc.perform(get("/api/knowledge-graph/nodes/" + created.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.node.label", is("ClickHouse Database")));

        // 3. Update Node
        mockMvc.perform(patch("/api/knowledge-graph/nodes/" + created.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("description", "Updated description for ClickHouse"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description", is("Updated description for ClickHouse")));

        // 4. Delete Node
        mockMvc.perform(delete("/api/knowledge-graph/nodes/" + created.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("success")));
    }

    @Test
    public void testCreateAndVerifyEdge() throws Exception {
        KnowledgeNode n1 = storageService.addOrUpdateNode(new KnowledgeNode("node-a", "TECHNOLOGY", "Spring Boot", "Backend"));
        KnowledgeNode n2 = storageService.addOrUpdateNode(new KnowledgeNode("node-b", "TECHNOLOGY", "PostgreSQL", "Database"));

        KnowledgeEdge edge = new KnowledgeEdge();
        edge.setSource("node-a");
        edge.setTarget("node-b");
        edge.setRelation("USES_TECHNOLOGY");
        edge.setDescription("Spring Boot connects to PostgreSQL");
        edge.setInferred(true);

        String edgeRes = mockMvc.perform(post("/api/knowledge-graph/edges")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(edge)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.relation", is("USES_TECHNOLOGY")))
                .andReturn().getResponse().getContentAsString();

        KnowledgeEdge createdEdge = objectMapper.readValue(edgeRes, KnowledgeEdge.class);

        // Verify Edge (confirm inferred)
        mockMvc.perform(post("/api/knowledge-graph/edges/" + createdEdge.getId() + "/verify?verified=true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("VERIFIED")))
                .andExpect(jsonPath("$.inferred", is(false)));

        // Delete Edge
        mockMvc.perform(delete("/api/knowledge-graph/edges/" + createdEdge.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("success")));
    }

    @Test
    public void testAskKnowledgeGraphEndpoint() throws Exception {
        KnowledgeNode n1 = storageService.addOrUpdateNode(new KnowledgeNode("p1", "PROJECT", "Analytics Project", "Analytics system"));
        KnowledgeNode n2 = storageService.addOrUpdateNode(new KnowledgeNode("t1", "TECHNOLOGY", "React", "UI"));
        storageService.addOrUpdateEdge(new KnowledgeEdge("e1", "p1", "t1", "USES_TECHNOLOGY", "Uses"));

        Map<String, String> req = Map.of("question", "What technology does Analytics Project use?");

        mockMvc.perform(post("/api/knowledge-graph/ask")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer", notNullValue()))
                .andExpect(jsonPath("$.insufficientEvidence", is(false)));
    }

    @Test
    public void testInsightsEndpoint() throws Exception {
        storageService.addOrUpdateNode(new KnowledgeNode("p1", "PROJECT", "P1", "Project"));
        storageService.addOrUpdateNode(new KnowledgeNode("t1", "TECHNOLOGY", "T1", "Tech"));
        storageService.addOrUpdateEdge(new KnowledgeEdge("e1", "p1", "t1", "USES_TECHNOLOGY", "Uses"));

        mockMvc.perform(get("/api/knowledge-graph/insights"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalNodes", is(2)))
                .andExpect(jsonPath("$.totalEdges", is(1)))
                .andExpect(jsonPath("$.projectsWithTech", hasSize(1)));
    }

    @Test
    public void testMergeNodesEndpoint() throws Exception {
        KnowledgeNode n1 = storageService.addOrUpdateNode(new KnowledgeNode("target-1", "TECHNOLOGY", "PostgreSQL", "Main target"));
        KnowledgeNode n2 = storageService.addOrUpdateNode(new KnowledgeNode("source-1", "TECHNOLOGY", "Postgres", "To be merged"));

        Map<String, String> mergeReq = Map.of(
                "sourceNodeId", "source-1",
                "targetNodeId", "target-1"
        );

        mockMvc.perform(post("/api/knowledge-graph/nodes/merge")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mergeReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label", is("PostgreSQL")))
                .andExpect(jsonPath("$.aliases", hasItem("Postgres")));
    }
}
