package com.coderarmy.ragsupport;

import org.springframework.ai.mcp.annotation.McpArg;
import org.springframework.ai.mcp.annotation.McpPrompt;
import org.springframework.stereotype.Component;

@Component
public class CustomerSupportMcpPrompts {

    @McpPrompt(
        name = "customer_support",
        description = "Reusable prompt template for customer support queries with vector-search RAG retrieval guidance"
    )
    public String customerSupportPrompt(
            @McpArg(name = "customerQuery", description = "The customer's support query", required = true) String customerQuery) {
        return """
            Help me resolve the customer's support query: %s.

            First, use the available knowledge-retrieval/vector-search tool
            to retrieve the most relevant information from the customer-support
            knowledge base.

            Then, use the retrieved context to provide a concise, accurate,
            and helpful response to the customer.

            Do not invent information that is not present in the retrieved context.
            If the knowledge base does not contain enough information to answer
            the query, clearly state that the information is unavailable and
            suggest contacting human support.

            Keep the response professional, easy to understand,
            and directly focused on the customer's question.
            """.formatted(customerQuery);
    }
}
