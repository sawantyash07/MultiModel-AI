package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.ChatMessage;
import com.coderarmy.ragsupport.model.ChatSession;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ChatSessionService {

    private static final Logger log = LoggerFactory.getLogger(ChatSessionService.class);
    private static final String STORAGE_FILE_PATH = "data/chat_sessions.json";

    private final Map<String, ChatSession> sessionStore = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public ChatSessionService() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.findAndRegisterModules();
    }

    @PostConstruct
    public synchronized void initStore() {
        loadFromDisk();
        contextualizeAllSessionTitles();
        if (sessionStore.isEmpty()) {
            String initialId = UUID.randomUUID().toString();
            ChatSession initialSession = new ChatSession(initialId, "Multimodal Assistant Overview");
            initialSession.addMessage(ChatMessage.assistantMessage(
                    UUID.randomUUID().toString(),
                    "👋 Hello! I am your Multimodal Assistant powered by Spring Boot and Spring AI.\n\n" +
                    "I can stream responses in real-time, analyze images, read PDF documents, remember our conversation history across turns, and answer questions.\n\n" +
                    "Upload an image/PDF or ask any question to get started!"
            ));
            sessionStore.put(initialId, initialSession);
            saveToDisk();
        }
    }

    public List<ChatSession> getAllSessions() {
        contextualizeAllSessionTitles();
        return sessionStore.values().stream()
                .filter(s -> s.getMessages() != null && !s.getMessages().isEmpty())
                .sorted(Comparator.comparing(ChatSession::getLastUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    public ChatSession getSession(String sessionId) {
        return sessionStore.get(sessionId);
    }

    public ChatSession getOrCreateSession(String sessionId, String firstPrompt) {
        if (sessionId != null && !sessionId.isBlank() && sessionStore.containsKey(sessionId)) {
            return sessionStore.get(sessionId);
        }

        String newId = (sessionId != null && !sessionId.isBlank()) ? sessionId : UUID.randomUUID().toString();
        String title = "New Conversation";
        if (firstPrompt != null && !firstPrompt.isBlank()) {
            title = firstPrompt.length() > 30 ? firstPrompt.substring(0, 30) + "..." : firstPrompt;
        }

        ChatSession session = new ChatSession(newId, title);
        sessionStore.put(newId, session);
        saveToDisk();
        return session;
    }

    public void addMessageToSession(String sessionId, ChatMessage message) {
        ChatSession session = getOrCreateSession(sessionId, message.getContent());
        session.addMessage(message);
        saveToDisk();
    }

    public boolean deleteSession(String sessionId) {
        boolean removed = sessionStore.remove(sessionId) != null;
        if (removed) {
            saveToDisk();
        }
        return removed;
    }

    public ChatSession renameSession(String sessionId, String newTitle) {
        ChatSession session = sessionStore.get(sessionId);
        if (session != null && newTitle != null && !newTitle.isBlank()) {
            session.setTitle(newTitle.trim());
            saveToDisk();
        }
        return session;
    }

    public boolean truncateSessionFromMessage(String sessionId, String messageId) {
        ChatSession session = sessionStore.get(sessionId);
        if (session == null || session.getMessages() == null) {
            return false;
        }
        List<ChatMessage> list = session.getMessages();
        int targetIdx = -1;
        for (int i = 0; i < list.size(); i++) {
            if (messageId.equals(list.get(i).getId())) {
                targetIdx = i;
                break;
            }
        }
        if (targetIdx != -1) {
            List<ChatMessage> subList = new ArrayList<>(list.subList(0, targetIdx));
            session.setMessages(subList);
            session.setLastUpdatedAt(java.time.LocalDateTime.now());
            saveToDisk();
            return true;
        }
        return false;
    }

    public void clearAllSessions() {
        sessionStore.clear();
        saveToDisk();
    }

    public synchronized void contextualizeAllSessionTitles() {
        boolean modified = false;
        // 1. Prune completely empty sessions from disk store
        List<String> emptyIds = sessionStore.values().stream()
                .filter(s -> s.getMessages() == null || s.getMessages().isEmpty())
                .map(ChatSession::getSessionId)
                .collect(Collectors.toList());
        for (String id : emptyIds) {
            sessionStore.remove(id);
            modified = true;
        }

        // 2. Rename default or generic session titles according to conversation context
        for (ChatSession session : sessionStore.values()) {
            String title = session.getTitle();
            if (title == null || title.isBlank() || "New chat".equalsIgnoreCase(title)
                    || "New Conversation".equalsIgnoreCase(title) || "Welcome & Overview".equalsIgnoreCase(title)
                    || "ChatGPT Multimodal".equalsIgnoreCase(title) || "Customer Support Assistant".equalsIgnoreCase(title)
                    || "Multimodal Assistant".equalsIgnoreCase(title) || "Multimodal AI Assistant".equalsIgnoreCase(title)) {
                String smartTitle = generateContextualTitle(session);
                if (smartTitle != null && !smartTitle.isBlank()) {
                    session.setTitle(smartTitle);
                    modified = true;
                }
            }
        }

        if (modified) {
            saveToDisk();
        }
    }

    public String generateContextualTitle(ChatSession session) {
        if (session == null || session.getMessages() == null || session.getMessages().isEmpty()) {
            return "New Chat";
        }
        List<ChatMessage> msgs = session.getMessages();

        // Check if any message in the session has an image or document
        for (ChatMessage m : msgs) {
            if ("user".equalsIgnoreCase(m.getRole())) {
                if (m.getImageName() != null && !m.getImageName().isBlank()) {
                    return "Image Analysis: " + m.getImageName();
                }
                if (m.getFileName() != null && !m.getFileName().isBlank()) {
                    return "Document: " + m.getFileName();
                }
            }
        }

        // Collect user messages
        List<ChatMessage> userMsgs = msgs.stream()
                .filter(m -> "user".equalsIgnoreCase(m.getRole()) && m.getContent() != null && !m.getContent().isBlank())
                .collect(Collectors.toList());

        if (userMsgs.isEmpty()) {
            return "Support Assistant Overview";
        }

        // Find the most representative user message (skip trivial greetings like "hi", "hello" if subsequent messages exist)
        ChatMessage targetMsg = userMsgs.get(0);
        for (ChatMessage uMsg : userMsgs) {
            String c = uMsg.getContent().trim().toLowerCase();
            if (!c.matches("^(hi|hello|hey|good morning|good afternoon|good evening)[!.]?$")) {
                targetMsg = uMsg;
                break;
            }
        }

        String content = targetMsg.getContent().trim();
        String lower = content.toLowerCase();

        if (lower.contains("name is yash") || lower.contains("yash")) {
            return "Greeting & Intro (Yash)";
        }
        if (lower.contains("tell me about yourself") || lower.contains("who are you") || lower.contains("what can you do")) {
            return "AI Assistant Capabilities";
        }
        if (lower.contains("tell me about myself") || lower.contains("who am i")) {
            return "Profile & Memory Inquiry";
        }
        if (lower.contains("return") || lower.contains("exchange")) {
            return "Return & Exchange Policy";
        }
        if (lower.contains("refund") || lower.contains("payment") || lower.contains("money back")) {
            return "Payment & Refund Policy";
        }
        if (lower.contains("shipping") || lower.contains("deliver") || lower.contains("track")) {
            return "Shipping & Delivery Info";
        }
        if (lower.contains("order") || lower.contains("cancel")) {
            return "Order Help & Management";
        }
        if (lower.contains("java") || lower.contains("code") || lower.contains("spring") || lower.contains("api")) {
            return "Java & Technical Discussion";
        }

        String clean = content.replaceAll("^(hello|hi|hey|greetings|please|can you|could you)\\s*", "").trim();
        clean = clean.replaceAll("[?.,!]+$", "").trim();
        if (clean.length() > 32) {
            clean = clean.substring(0, 32).trim() + "...";
        }
        if (!clean.isBlank()) {
            return Character.toUpperCase(clean.charAt(0)) + clean.substring(1);
        }
        return "Conversation " + session.getSessionId().substring(0, Math.min(6, session.getSessionId().length()));
    }

    public List<ChatMessage> getRecentHistory(String sessionId, int maxMessages) {
        ChatSession session = sessionStore.get(sessionId);
        if (session == null || session.getMessages() == null) {
            return Collections.emptyList();
        }

        List<ChatMessage> all = session.getMessages();
        if (all.size() <= maxMessages) {
            return new ArrayList<>(all);
        }
        return new ArrayList<>(all.subList(all.size() - maxMessages, all.size()));
    }

    private synchronized void saveToDisk() {
        try {
            File file = new File(STORAGE_FILE_PATH);
            File parentDir = file.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }
            objectMapper.writeValue(file, new ArrayList<>(sessionStore.values()));
        } catch (IOException e) {
            log.error("Failed to persist chat sessions to disk", e);
        }
    }

    private synchronized void loadFromDisk() {
        File file = new File(STORAGE_FILE_PATH);
        if (!file.exists()) {
            return;
        }
        try {
            List<ChatSession> sessions = objectMapper.readValue(file, new TypeReference<List<ChatSession>>() {});
            sessionStore.clear();
            for (ChatSession session : sessions) {
                if (session.getSessionId() != null) {
                    sessionStore.put(session.getSessionId(), session);
                }
            }
            log.info("Loaded {} persistent chat sessions from disk", sessionStore.size());
        } catch (IOException e) {
            log.error("Failed to load chat sessions from disk", e);
        }
    }
}
