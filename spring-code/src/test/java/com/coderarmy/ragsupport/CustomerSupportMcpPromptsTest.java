package com.coderarmy.ragsupport;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CustomerSupportMcpPromptsTest {

    @Test
    void testCustomerSupportPromptFormatting() {
        CustomerSupportMcpPrompts prompts = new CustomerSupportMcpPrompts();
        String query = "What is the policy for returns and refunds?";
        String result = prompts.customerSupportPrompt(query);

        assertNotNull(result, "Prompt result should not be null");
        assertTrue(result.contains(query), "Prompt should contain the customer query");
        assertTrue(result.contains("use the available knowledge-retrieval/vector-search tool"), "Prompt should direct tool use");
        assertTrue(result.contains("contacting human support"), "Prompt should specify human support fallback");
    }
}
