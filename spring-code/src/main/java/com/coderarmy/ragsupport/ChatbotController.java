package com.coderarmy.ragsupport;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class ChatbotController {

    private final ChatbotService chatbotService;
    private final CustomerSupportMcpPrompts mcpPrompts;

    public ChatbotController(ChatbotService chatbotService, CustomerSupportMcpPrompts mcpPrompts) {
        this.chatbotService = chatbotService;
        this.mcpPrompts = mcpPrompts;
    }

    @GetMapping("/query")
    public Map<String, String> query(@RequestParam String question) {
        return Map.of("answer", chatbotService.answerUserQuery(question));
    }

    @GetMapping("/prompts/list")
    public Map<String, Object> listPrompts() {
        return Map.of(
            "prompts", List.of(
                Map.of(
                    "name", "customer_support",
                    "description", "Reusable prompt template for customer support queries with vector-search RAG retrieval guidance",
                    "arguments", List.of(
                        Map.of(
                            "name", "customerQuery",
                            "description", "The customer's support query",
                            "required", true
                        )
                    )
                )
            )
        );
    }

    @GetMapping("/prompts/get")
    public Map<String, Object> getPromptGet(
            @RequestParam(defaultValue = "customer_support") String name,
            @RequestParam(required = false) String customerQuery) {
        return executeGetPrompt(name, customerQuery);
    }

    @PostMapping("/prompts/get")
    public Map<String, Object> getPromptPost(@RequestBody Map<String, Object> body) {
        String name = (String) body.getOrDefault("name", "customer_support");
        String customerQuery = null;

        if (body.get("arguments") instanceof Map<?, ?> argsMap) {
            Object q = argsMap.get("customerQuery");
            if (q != null) customerQuery = q.toString();
        }
        if (customerQuery == null && body.get("customerQuery") != null) {
            customerQuery = body.get("customerQuery").toString();
        }

        return executeGetPrompt(name, customerQuery);
    }

    private Map<String, Object> executeGetPrompt(String name, String customerQuery) {
        if (!"customer_support".equalsIgnoreCase(name)) {
            throw new IllegalArgumentException("Unknown prompt name: " + name);
        }

        String query = (customerQuery != null && !customerQuery.isBlank())
                ? customerQuery
                : "What is your return policy?";

        String formattedPrompt = mcpPrompts.customerSupportPrompt(query);

        return Map.of(
            "name", "customer_support",
            "description", "Reusable prompt template for customer support queries with vector-search RAG retrieval guidance",
            "messages", List.of(
                Map.of(
                    "role", "user",
                    "content", Map.of(
                        "type", "text",
                        "text", formattedPrompt
                    )
                )
            )
        );
    }
}
