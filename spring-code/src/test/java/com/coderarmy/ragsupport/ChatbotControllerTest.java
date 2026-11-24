package com.coderarmy.ragsupport;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.anyString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ChatbotControllerTest {

    private MockMvc mockMvc;
    private ChatbotService chatbotService;
    private CustomerSupportMcpPrompts mcpPrompts;

    @BeforeEach
    void setUp() {
        chatbotService = Mockito.mock(ChatbotService.class);
        mcpPrompts = Mockito.mock(CustomerSupportMcpPrompts.class);
        ChatbotController controller = new ChatbotController(chatbotService, mcpPrompts);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void testListPrompts() throws Exception {
        mockMvc.perform(get("/api/v1/prompts/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prompts", hasSize(1)))
                .andExpect(jsonPath("$.prompts[0].name", is("customer_support")))
                .andExpect(jsonPath("$.prompts[0].arguments[0].name", is("customerQuery")));
    }

    @Test
    void testGetPrompt() throws Exception {
        Mockito.when(mcpPrompts.customerSupportPrompt(anyString()))
                .thenReturn("Help me resolve the customer's support query: What is the return policy?");

        mockMvc.perform(get("/api/v1/prompts/get").param("name", "customer_support").param("customerQuery", "What is the return policy?"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("customer_support")))
                .andExpect(jsonPath("$.messages[0].content.text", containsString("What is the return policy?")));
    }
}
