package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.UserMemory;
import com.coderarmy.ragsupport.model.kg.*;
import com.coderarmy.ragsupport.service.kg.KnowledgeExtractionPipeline;
import com.coderarmy.ragsupport.service.kg.KnowledgeGraphQueryService;
import com.coderarmy.ragsupport.service.kg.KnowledgeGraphStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class KnowledgeGraphServiceTest {

    private KnowledgeGraphStorageService storageService;
    private KnowledgeExtractionPipeline extractionPipeline;
    private KnowledgeGraphQueryService queryService;

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
    }

    @Test
    public void testCreateNodeAndEdgeWithProvenance() {
        KnowledgeSourceRef source1 = new KnowledgeSourceRef("conversation", "conv-101", "Architecture Discussion", "msg-1", "We use Spring Boot for our microservices.");
        KnowledgeNode node1 = new KnowledgeNode("node-sb", "TECHNOLOGY", "Spring Boot", "Enterprise Java framework");
        node1.addSource(source1);
        storageService.addOrUpdateNode(node1);

        KnowledgeSourceRef source2 = new KnowledgeSourceRef("conversation", "conv-101", "Architecture Discussion", "msg-2", "The analytics dashboard uses React for the frontend.");
        KnowledgeNode node2 = new KnowledgeNode("node-react", "TECHNOLOGY", "React", "Frontend JavaScript library");
        node2.addSource(source2);
        storageService.addOrUpdateNode(node2);

        KnowledgeEdge edge = new KnowledgeEdge("edge-sb-react", node1.getId(), node2.getId(), "RELATED_TO", "Complements");
        edge.setDescription("Spring Boot serves APIs consumed by React frontend.");
        edge.addSource(source1);
        storageService.addOrUpdateEdge(edge);

        assertEquals(2, storageService.getAllNodes().size());
        assertEquals(1, storageService.getAllEdges().size());

        Optional<KnowledgeNode> fetchedNode = storageService.getNode("node-sb");
        assertTrue(fetchedNode.isPresent());
        assertEquals("Spring Boot", fetchedNode.get().getLabel());
        assertEquals(1, fetchedNode.get().getSources().size());
        assertEquals("conv-101", fetchedNode.get().getSources().get(0).getSourceId());
    }

    @Test
    public void testEntityDeduplicationAndAliasMerging() {
        KnowledgeSourceRef source1 = new KnowledgeSourceRef("conversation", "conv-1", "Frontend Chat", "msg-1", "Built with React.js.");
        KnowledgeNode node1 = new KnowledgeNode("node-react", "TECHNOLOGY", "React", "UI library");
        node1.addAlias("React.js");
        node1.addSource(source1);
        storageService.addOrUpdateNode(node1);

        // Lookup by alias "React.js"
        Optional<KnowledgeNode> foundByAlias = storageService.findNodeByLabelOrAlias("React.js");
        assertTrue(foundByAlias.isPresent());
        assertEquals("React", foundByAlias.get().getLabel());

        // Merge a second mention with another source
        KnowledgeSourceRef source2 = new KnowledgeSourceRef("document", "doc-spec", "Architecture.pdf", 3, "Frontend uses React framework.");
        KnowledgeNode existing = foundByAlias.get();
        existing.addSource(source2);
        existing.addAlias("React framework");
        storageService.addOrUpdateNode(existing);

        assertEquals(1, storageService.getAllNodes().size());
        assertEquals(2, storageService.getAllNodes().get(0).getSources().size());
        assertTrue(storageService.getAllNodes().get(0).getAliases().contains("React framework"));
    }

    @Test
    public void testSearchAndFiltering() {
        KnowledgeNode proj = new KnowledgeNode("node-proj-ecom", "PROJECT", "E-Commerce Analytics", "Dashboard project");
        proj.addSource(new KnowledgeSourceRef("memory", "mem-1", "Active Projects", "Active dashboard project"));
        storageService.addOrUpdateNode(proj);

        KnowledgeNode tech = new KnowledgeNode("node-tech-clickhouse", "TECHNOLOGY", "ClickHouse", "Columnar analytics DB");
        tech.addSource(new KnowledgeSourceRef("conversation", "conv-db", "DB Discussion", "We query ClickHouse for aggregates"));
        storageService.addOrUpdateNode(tech);

        KnowledgeEdge edge = new KnowledgeEdge("edge-1", proj.getId(), tech.getId(), "USES_TECHNOLOGY", "Uses Technology");
        storageService.addOrUpdateEdge(edge);

        // Search by query
        KnowledgeGraph qRes = storageService.searchAndFilter("clickhouse", null, null, null);
        assertEquals(1, qRes.getNodes().size());
        assertEquals("ClickHouse", qRes.getNodes().get(0).getLabel());

        // Filter by type
        KnowledgeGraph typeRes = storageService.searchAndFilter(null, "PROJECT", null, null);
        assertEquals(1, typeRes.getNodes().size());
        assertEquals("E-Commerce Analytics", typeRes.getNodes().get(0).getLabel());

        // Filter by source
        KnowledgeGraph srcRes = storageService.searchAndFilter(null, null, "conversation", null);
        assertEquals(1, srcRes.getNodes().size());
        assertEquals("ClickHouse", srcRes.getNodes().get(0).getLabel());
    }

    @Test
    public void testNeighborhoodTraversal() {
        KnowledgeNode n1 = storageService.addOrUpdateNode(new KnowledgeNode("n1", "PROJECT", "Project Alpha", "Core Project"));
        KnowledgeNode n2 = storageService.addOrUpdateNode(new KnowledgeNode("n2", "TECHNOLOGY", "Docker", "Container engine"));
        KnowledgeNode n3 = storageService.addOrUpdateNode(new KnowledgeNode("n3", "TASK", "Setup CI Pipeline", "CI Task"));
        KnowledgeNode n4 = storageService.addOrUpdateNode(new KnowledgeNode("n4", "TECHNOLOGY", "GitHub Actions", "CI engine"));

        storageService.addOrUpdateEdge(new KnowledgeEdge("e1", n1.getId(), n2.getId(), "USES_TECHNOLOGY", "Uses"));
        storageService.addOrUpdateEdge(new KnowledgeEdge("e2", n1.getId(), n3.getId(), "HAS_TASK", "Task"));
        storageService.addOrUpdateEdge(new KnowledgeEdge("e3", n3.getId(), n4.getId(), "DEPENDS_ON", "Depends"));

        // 1-hop neighborhood of n1 should have n1, n2, n3
        KnowledgeGraph hop1 = storageService.getNeighborhood("n1", 1);
        assertEquals(3, hop1.getNodes().size());
        assertEquals(2, hop1.getEdges().size());

        // 2-hop neighborhood of n1 should also include n4
        KnowledgeGraph hop2 = storageService.getNeighborhood("n1", 2);
        assertEquals(4, hop2.getNodes().size());
        assertEquals(3, hop2.getEdges().size());
    }

    @Test
    public void testCascadeDeleteNode() {
        KnowledgeNode n1 = storageService.addOrUpdateNode(new KnowledgeNode("node-a", "CONCEPT", "Concept A", "A"));
        KnowledgeNode n2 = storageService.addOrUpdateNode(new KnowledgeNode("node-b", "CONCEPT", "Concept B", "B"));
        storageService.addOrUpdateEdge(new KnowledgeEdge("edge-ab", n1.getId(), n2.getId(), "RELATED_TO", "Rel"));

        assertEquals(2, storageService.getAllNodes().size());
        assertEquals(1, storageService.getAllEdges().size());

        // Delete node-a: edge-ab should be automatically cleaned up
        boolean deleted = storageService.deleteNode("node-a");
        assertTrue(deleted);
        assertEquals(1, storageService.getAllNodes().size());
        assertEquals(0, storageService.getAllEdges().size());
    }

    @Test
    public void testMergeNodes() {
        KnowledgeNode node1 = storageService.addOrUpdateNode(new KnowledgeNode("n-target", "TECHNOLOGY", "PostgreSQL", "Relational database"));
        node1.addSource(new KnowledgeSourceRef("conversation", "c1", "Chat 1", "Uses Postgres"));
        storageService.addOrUpdateNode(node1);

        KnowledgeNode node2 = storageService.addOrUpdateNode(new KnowledgeNode("n-source", "TECHNOLOGY", "Postgres", "SQL DB"));
        node2.addSource(new KnowledgeSourceRef("document", "d1", "Specs.pdf", 1, "Database: Postgres"));
        storageService.addOrUpdateNode(node2);

        KnowledgeNode node3 = storageService.addOrUpdateNode(new KnowledgeNode("n-proj", "PROJECT", "Shop", "Shop App"));
        storageService.addOrUpdateEdge(new KnowledgeEdge("e-p-s", node3.getId(), node2.getId(), "USES_TECHNOLOGY", "Uses"));

        // Merge node2 into node1
        KnowledgeNode merged = storageService.mergeNodes("n-source", "n-target");
        assertEquals("PostgreSQL", merged.getLabel());
        assertTrue(merged.getAliases().contains("Postgres"));
        assertEquals(2, merged.getSources().size());
        assertEquals(2, storageService.getAllNodes().size());

        // Edge should now point to n-target
        assertEquals(1, storageService.getAllEdges().size());
        KnowledgeEdge updatedEdge = storageService.getAllEdges().get(0);
        assertEquals("n-proj", updatedEdge.getSource());
        assertEquals("n-target", updatedEdge.getTarget());
    }

    @Test
    public void testAskGroundedQuestion() {
        KnowledgeSourceRef src = new KnowledgeSourceRef("memory", "mem-ecom", "Analytics Project Memory", "Active project: E-Commerce Analytics Dashboard using React, Spring Boot, and ClickHouse");
        KnowledgeNode proj = new KnowledgeNode("node-p1", "PROJECT", "E-Commerce Analytics Dashboard", "Real-time analytics dashboard");
        proj.addSource(src);
        storageService.addOrUpdateNode(proj);

        KnowledgeNode react = new KnowledgeNode("node-t1", "TECHNOLOGY", "React", "Frontend library");
        react.addSource(src);
        storageService.addOrUpdateNode(react);

        KnowledgeNode spring = new KnowledgeNode("node-t2", "TECHNOLOGY", "Spring Boot", "Backend framework");
        spring.addSource(src);
        storageService.addOrUpdateNode(spring);

        storageService.addOrUpdateEdge(new KnowledgeEdge("e1", proj.getId(), react.getId(), "USES_TECHNOLOGY", "Uses React"));
        storageService.addOrUpdateEdge(new KnowledgeEdge("e2", proj.getId(), spring.getId(), "USES_TECHNOLOGY", "Uses Spring Boot"));

        KnowledgeAskRequest req = new KnowledgeAskRequest("Which projects use React and Spring Boot?");
        KnowledgeAskResponse resp = queryService.ask(req);

        assertNotNull(resp);
        assertFalse(resp.isInsufficientEvidence());
        assertTrue(resp.getAnswer().contains("E-Commerce Analytics Dashboard") || resp.getAnswer().contains("React"));
        assertTrue(resp.getCitedNodes().stream().anyMatch(n -> "E-Commerce Analytics Dashboard".equals(n.getLabel())));
    }

    @Test
    public void testAskWithNoMatchingEvidenceStatesClearly() {
        storageService.addOrUpdateNode(new KnowledgeNode("n1", "TECHNOLOGY", "Java", "Java language"));

        KnowledgeAskRequest req = new KnowledgeAskRequest("What is the recipe for chocolate cake?");
        KnowledgeAskResponse resp = queryService.ask(req);

        assertNotNull(resp);
        assertTrue(resp.isInsufficientEvidence());
        assertTrue(resp.getAnswer().toLowerCase().contains("no matching evidence was found"));
    }

    @Test
    public void testInsightsComputation() {
        KnowledgeNode p1 = storageService.addOrUpdateNode(new KnowledgeNode("p1", "PROJECT", "Project 1", "App"));
        KnowledgeNode t1 = storageService.addOrUpdateNode(new KnowledgeNode("t1", "TECHNOLOGY", "React", "UI"));
        KnowledgeNode t2 = storageService.addOrUpdateNode(new KnowledgeNode("t2", "TECHNOLOGY", "Spring Boot", "API"));
        KnowledgeNode task = storageService.addOrUpdateNode(new KnowledgeNode("task1", "TASK", "Fix Redis Cache", "Task"));
        task.setStatus("UNRESOLVED");
        storageService.addOrUpdateNode(task);

        storageService.addOrUpdateEdge(new KnowledgeEdge("e1", p1.getId(), t1.getId(), "USES_TECHNOLOGY", "Uses"));
        storageService.addOrUpdateEdge(new KnowledgeEdge("e2", p1.getId(), t2.getId(), "USES_TECHNOLOGY", "Uses"));
        storageService.addOrUpdateEdge(new KnowledgeEdge("e3", p1.getId(), task.getId(), "HAS_TASK", "Has Task"));

        KnowledgeGraphInsights insights = queryService.computeInsights();
        assertEquals(4, insights.getTotalNodes());
        assertEquals(3, insights.getTotalEdges());
        assertEquals(1, insights.getUnresolvedTasks().size());
        assertEquals("Fix Redis Cache", insights.getUnresolvedTasks().get(0).get("task"));
        assertEquals(1, insights.getProjectsWithTech().size());
        assertEquals("Project 1", insights.getProjectsWithTech().get(0).get("projectName"));
    }
}
