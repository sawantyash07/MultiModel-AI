package com.coderarmy.ragsupport.controller;

import com.coderarmy.ragsupport.model.ChatMessage;
import com.coderarmy.ragsupport.model.ChatSession;
import com.coderarmy.ragsupport.model.MultimodalChatResponse;
import com.coderarmy.ragsupport.model.MultimodalConceptExplanation;
import com.coderarmy.ragsupport.service.ChatSessionService;
import com.coderarmy.ragsupport.service.MultimodalAiService;
import com.coderarmy.ragsupport.service.MultimodalConceptService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import reactor.core.publisher.Flux;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MultimodalChatControllerTest {

    private MockMvc mockMvc;
    private MultimodalAiService multimodalAiService;
    private ChatSessionService chatSessionService;
    private MultimodalConceptService multimodalConceptService;

    @BeforeEach
    void setUp() {
        multimodalAiService = Mockito.mock(MultimodalAiService.class);
        chatSessionService = Mockito.mock(ChatSessionService.class);
        multimodalConceptService = Mockito.mock(MultimodalConceptService.class);

        MultimodalChatController controller = new MultimodalChatController(
                multimodalAiService,
                chatSessionService,
                multimodalConceptService
        );
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void testChatMultimodalMultipart() throws Exception {
        ChatMessage uMsg = ChatMessage.userMessage("1", "Analyze image", null, "test.png", "image/png");
        ChatMessage aMsg = ChatMessage.assistantMessage("2", "This is a test image.");
        MultimodalChatResponse response = new MultimodalChatResponse("sess-1", "This is a test image.", uMsg, aMsg, 2, false);

        Mockito.when(multimodalAiService.processMultimodalQuery(any(), anyString(), any(), any(), any(), any()))
                .thenReturn(response);

        MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", "fake-image".getBytes());

        mockMvc.perform(multipart("/api/v1/chat/multimodal")
                        .file(file)
                        .param("prompt", "Analyze image")
                        .param("sessionId", "sess-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId", is("sess-1")))
                .andExpect(jsonPath("$.answer", containsString("This is a test image.")));
    }

    @Test
    void testStreamChatMultipart() throws Exception {
        ServerSentEvent<String> sse1 = ServerSentEvent.<String>builder().event("init").data("{\"sessionId\":\"sess-stream\"}").build();
        ServerSentEvent<String> sse2 = ServerSentEvent.<String>builder().event("token").data("{\"token\":\"Hello\"}").build();
        ServerSentEvent<String> sse3 = ServerSentEvent.<String>builder().event("done").data("{\"sessionId\":\"sess-stream\"}").build();

        Mockito.when(multimodalAiService.streamMultimodalQuery(any(), anyString(), any(), any(), any(), any()))
                .thenReturn(Flux.just(sse1, sse2, sse3));

        MockMultipartFile file = new MockMultipartFile("file", "test.pdf", "application/pdf", "fake pdf".getBytes());

        mockMvc.perform(multipart("/api/v1/chat/stream")
                        .file(file)
                        .param("prompt", "Summarize PDF")
                        .param("sessionId", "sess-stream")
                        .accept(MediaType.TEXT_EVENT_STREAM_VALUE))
                .andExpect(status().isOk());
    }

    @Test
    void testGetAllChatSessions() throws Exception {
        ChatSession session = new ChatSession("sess-1", "Test Session");
        Mockito.when(chatSessionService.getAllSessions()).thenReturn(List.of(session));

        mockMvc.perform(get("/api/v1/chats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].sessionId", is("sess-1")))
                .andExpect(jsonPath("$[0].title", is("Test Session")));
    }

    @Test
    void testGetMultimodalConcepts() throws Exception {
        MultimodalConceptExplanation exp = new MultimodalConceptExplanation(
                "Multimodal AI Test", "Overview test", List.of(), java.util.Map.of(), List.of()
        );
        Mockito.when(multimodalConceptService.getExplanation()).thenReturn(exp);

        mockMvc.perform(get("/api/v1/multimodal/concepts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", is("Multimodal AI Test")));
    }

    @Test
    void testRenameChatSession() throws Exception {
        ChatSession session = new ChatSession("sess-1", "Renamed Session");
        Mockito.when(chatSessionService.renameSession(Mockito.eq("sess-1"), Mockito.eq("Renamed Session"))).thenReturn(session);

        mockMvc.perform(patch("/api/v1/chats/sess-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Renamed Session\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId", is("sess-1")))
                .andExpect(jsonPath("$.title", is("Renamed Session")));
    }

    @Test
    void testTruncateSessionFromMessage() throws Exception {
        Mockito.when(chatSessionService.truncateSessionFromMessage("sess-1", "msg-1")).thenReturn(true);

        mockMvc.perform(delete("/api/v1/chats/sess-1/messages/msg-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId", is("sess-1")))
                .andExpect(jsonPath("$.messageId", is("msg-1")))
                .andExpect(jsonPath("$.truncated", is(true)));
    }

    @Test
    void testGetDynamicSuggestions() throws Exception {
        Mockito.when(multimodalAiService.generateDynamicSuggestions(Mockito.any(), Mockito.any(), Mockito.any()))
                .thenReturn(List.of("Show me a code example?", "Explain the return policy?"));

        mockMvc.perform(post("/api/v1/chat/suggestions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"sess-1\",\"prompt\":\"how to return\",\"answer\":\"You can return within 30 days.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions", hasSize(2)))
                .andExpect(jsonPath("$.suggestions[0]", is("Show me a code example?")));
    }
}
