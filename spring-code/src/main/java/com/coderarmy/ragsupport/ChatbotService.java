package com.coderarmy.ragsupport;

import jakarta.annotation.PostConstruct;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.document.Document;
import org.springframework.ai.mcp.annotation.McpArg;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.reader.pdf.PagePdfDocumentReader;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ChatbotService {

    private final VectorStore vectorStore;
    private final ChatClient chatClient;

    @Value("classpath*:knowledge/*.pdf")
    private Resource[] policyFiles;

    public ChatbotService(VectorStore vectorStore, ChatClient.Builder chatClientBuilder) {
        this.vectorStore = vectorStore;
        this.chatClient = chatClientBuilder.build();
    }

    @PostConstruct
    public void loadKnowledgeBase() {
        if (policyFiles == null || policyFiles.length == 0) {
            return;
        }

        List<Document> allChunks = new ArrayList<>();

        TokenTextSplitter splitter = TokenTextSplitter.builder()
                .withChunkSize(300)
                .build();

        for (Resource resource : policyFiles) {
            try {
                PagePdfDocumentReader reader = new PagePdfDocumentReader(resource);
                List<Document> pages = reader.read();
                List<Document> chunks = splitter.apply(pages);
                allChunks.addAll(chunks);
            } catch (Exception e) {
                // Log or handle individual policy file read errors gracefully
            }
        }
        if (!allChunks.isEmpty()) {
            vectorStore.add(allChunks);
        }
    }

    @McpTool(
        name = "knowledge_retrieval",
        description = "Retrieve relevant policy documents and information from the multimodal assistant knowledge base using vector similarity search"
    )
    public String retrieveKnowledge(
            @McpArg(name = "query", description = "Search query or question for the knowledge base", required = true) String query) {
        List<Document> relevantChunks = vectorStore.similaritySearch(
                SearchRequest.builder()
                        .query(query)
                        .topK(4)
                        .build()
        );

        StringBuilder context = new StringBuilder();
        for (Document document : relevantChunks) {
            if (document != null && document.getText() != null) {
                context.append(document.getText()).append("\n\n");
            }
        }
        return context.toString().trim();
    }

    public String answerUserQuery(String question) {
        String finalContext = retrieveKnowledge(question);

        String prompt = """
                You are a multimodal assistant for our e-commerce company.

                Answer the customer using ONLY the company information provided below.

                If the answer is not available in the provided information, say:
                "I don't have that information in the company documents."
                
                COMPANY INFORMATION
                %s
                
                """.formatted(finalContext);

        return chatClient.prompt()
                .system(prompt)
                .user(question)
                .call()
                .content();
    }
}
