package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.ChatMessage;
import com.coderarmy.ragsupport.model.ChatSession;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ChatSessionServiceTest {

    @Test
    void testContextualTitleGeneration() {
        ChatSessionService service = new ChatSessionService();

        // 1. Session with user intro
        ChatSession introSession = new ChatSession("test-1", "New chat");
        introSession.addMessage(ChatMessage.userMessage("msg-1", "Hello my name is yash"));
        introSession.addMessage(ChatMessage.assistantMessage("msg-2", "Hello Yash!"));

        String title1 = service.generateContextualTitle(introSession);
        assertEquals("Greeting & Intro (Yash)", title1);

        // 2. Session with image analysis
        ChatSession imageSession = new ChatSession("test-2", "New chat");
        ChatMessage imgMsg = ChatMessage.userMessage("msg-3", "tell me about this image");
        imgMsg.setImageName("sunset-beach.jpg");
        imageSession.addMessage(imgMsg);

        String title2 = service.generateContextualTitle(imageSession);
        assertEquals("Image Analysis: sunset-beach.jpg", title2);

        // 3. Session with initial greeting followed by policy query
        ChatSession policySession = new ChatSession("test-3", "New chat");
        policySession.addMessage(ChatMessage.userMessage("msg-4", "Hello"));
        policySession.addMessage(ChatMessage.assistantMessage("msg-5", "Hi, how can I help?"));
        policySession.addMessage(ChatMessage.userMessage("msg-6", "What is the return policy?"));

        String title3 = service.generateContextualTitle(policySession);
        assertEquals("Return & Exchange Policy", title3);

        // 4. Session with coding query
        ChatSession codeSession = new ChatSession("test-4", "New chat");
        codeSession.addMessage(ChatMessage.userMessage("msg-7", "How to write a Spring Boot REST controller in Java?"));

        String title4 = service.generateContextualTitle(codeSession);
        assertEquals("Java & Technical Discussion", title4);
    }
}
