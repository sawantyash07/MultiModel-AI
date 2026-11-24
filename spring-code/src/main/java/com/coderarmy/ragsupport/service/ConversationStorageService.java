package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.Conversation;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ConversationStorageService {

    private static final Logger log = LoggerFactory.getLogger(ConversationStorageService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, Conversation> storage = new ConcurrentHashMap<>();
    private File dataFile;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.coderarmy.ragsupport.service.kg.KnowledgeGraphStorageService kgStorage;

    public ConversationStorageService() {
        resolveDataFile();
        loadFromDisk();
    }

    private void resolveDataFile() {
        File candidate1 = new File("spring-code/data/conversations.json");
        File candidate2 = new File("data/conversations.json");

        if (candidate1.exists() && candidate1.length() > 500) {
            this.dataFile = candidate1;
        } else if (candidate2.exists() && candidate2.length() > 500) {
            this.dataFile = candidate2;
        } else if (new File("spring-code/data").isDirectory()) {
            this.dataFile = candidate1;
        } else {
            this.dataFile = candidate2;
        }
    }

    private synchronized void loadFromDisk() {
        try {
            if (dataFile.exists()) {
                List<Conversation> list = objectMapper.readValue(dataFile, new TypeReference<List<Conversation>>() {});
                for (Conversation c : list) {
                    storage.put(c.getId(), c);
                }
                log.info("[ConversationStorage] Loaded {} conversations from {}", storage.size(), dataFile.getPath());
            }
        } catch (Exception e) {
            log.warn("[ConversationStorage] Failed to read conversations from disk: {}", e.getMessage());
        }
    }

    private synchronized void saveToDisk() {
        try {
            if (!dataFile.getParentFile().exists()) {
                dataFile.getParentFile().mkdirs();
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(dataFile, new ArrayList<>(storage.values()));
        } catch (Exception e) {
            log.warn("[ConversationStorage] Failed to write conversations to disk: {}", e.getMessage());
        }
    }

    public static String generateTitleFromPrompt(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            return "New Chat";
        }
        String clean = prompt.trim().replaceAll("[\\r\\n]+", " ");
        // Strip common conversational question prefixes
        clean = clean.replaceFirst("^(?i)(please\\s+|can\\s+you\\s+(please\\s+)?|could\\s+you\\s+(please\\s+)?|i\\s+want\\s+to\\s+|how\\s+to\\s+|how\\s+do\\s+i\\s+|what\\s+is\\s+|what\\s+are\\s+|explain\\s+|describe\\s+|write\\s+a\\s+|create\\s+a\\s+|generate\\s+an?\\s+)", "");
        clean = clean.replaceAll("^[\\p{Punct}\\s]+", "").replaceAll("[\\p{Punct}\\s]+$", "");

        if (clean.isBlank()) {
            clean = prompt.trim();
        }

        String[] words = clean.split("\\s+");
        StringBuilder titleBuilder = new StringBuilder();
        for (int i = 0; i < Math.min(words.length, 6); i++) {
            String word = words[i];
            if (word.isEmpty()) continue;
            String capitalized = Character.toUpperCase(word.charAt(0)) + (word.length() > 1 ? word.substring(1) : "");
            if (titleBuilder.length() + capitalized.length() + 1 > 36) {
                break;
            }
            if (titleBuilder.length() > 0) titleBuilder.append(" ");
            titleBuilder.append(capitalized);
        }

        String result = titleBuilder.toString().trim();
        if (result.isBlank()) {
            result = clean.length() > 30 ? clean.substring(0, 30) + "..." : clean;
        }
        return result;
    }

    public List<Conversation> getAllConversations(String searchQuery) {
        List<Conversation> list = new ArrayList<>(storage.values());

        // Automatically infer titles for existing conversations with messages that are still titled "New Chat"
        boolean modified = false;
        for (Conversation c : list) {
            if ((c.getTitle() == null || c.getTitle().equalsIgnoreCase("New Chat") || c.getTitle().equalsIgnoreCase("New Conversation"))
                    && c.getMessages() != null && !c.getMessages().isEmpty()) {
                for (Map<String, Object> m : c.getMessages()) {
                    if ("user".equalsIgnoreCase((String) m.get("role"))) {
                        String userContent = (String) m.get("content");
                        if (userContent != null && !userContent.isBlank()) {
                            c.setTitle(generateTitleFromPrompt(userContent));
                            modified = true;
                            break;
                        }
                    }
                }
            }
        }
        if (modified) {
            saveToDisk();
        }

        // Filter out empty conversations with 0 messages to avoid cluttering sidebar with duplicate blanks
        list = list.stream()
                .filter(c -> c.getMessages() != null && !c.getMessages().isEmpty())
                .collect(Collectors.toList());

        list.sort((a, b) -> {
            String t1 = a.getUpdatedAt() != null ? a.getUpdatedAt() : "";
            String t2 = b.getUpdatedAt() != null ? b.getUpdatedAt() : "";
            return t2.compareTo(t1);
        });

        if (searchQuery == null || searchQuery.trim().isEmpty()) {
            return list;
        }

        String q = searchQuery.toLowerCase().trim();
        return list.stream().filter(c ->
                (c.getTitle() != null && c.getTitle().toLowerCase().contains(q)) ||
                (c.getLastMessagePreview() != null && c.getLastMessagePreview().toLowerCase().contains(q))
        ).collect(Collectors.toList());
    }

    public Conversation getConversation(String id) {
        return storage.get(id);
    }

    public Conversation createConversation(String title, String modelId) {
        String id = "conv-" + UUID.randomUUID().toString();
        String now = Instant.now().toString();
        String finalTitle = (title != null && !title.isBlank() && !title.equalsIgnoreCase("New Chat"))
                ? title
                : "New Chat";
        Conversation conv = new Conversation(id, finalTitle,
                (modelId != null) ? modelId : "auto", now, now);
        storage.put(id, conv);
        saveToDisk();
        return conv;
    }

    public Conversation updateTitle(String id, String newTitle) {
        Conversation conv = storage.get(id);
        if (conv != null) {
            conv.setTitle(newTitle);
            conv.setUpdatedAt(Instant.now().toString());
            saveToDisk();
        }
        return conv;
    }

    public void appendMessage(String id, Map<String, Object> message) {
        Conversation conv = storage.get(id);
        if (conv == null && id != null && !id.isBlank()) {
            conv = new Conversation(id, "New Chat", (String) message.getOrDefault("modelId", "auto"),
                    Instant.now().toString(), Instant.now().toString());
            storage.put(id, conv);
        }
        if (conv != null) {
            Map<String, Object> mutableMsg = new LinkedHashMap<>(message);
            if (!mutableMsg.containsKey("id") || mutableMsg.get("id") == null) {
                mutableMsg.put("id", "msg-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6));
            }
            if (!mutableMsg.containsKey("createdAt") && !mutableMsg.containsKey("timestamp")) {
                mutableMsg.put("createdAt", Instant.now().toString());
            }
            conv.getMessages().add(mutableMsg);
            String content = (String) mutableMsg.get("content");
            if (content != null) {
                conv.setLastMessagePreview(content.length() > 60 ? content.substring(0, 60) + "..." : content);
            }
            // If the conversation still has placeholder title and a user message arrives, auto-generate title!
            String role = (String) mutableMsg.get("role");
            if ("user".equalsIgnoreCase(role) && content != null && !content.isBlank()) {
                if (conv.getTitle() == null || conv.getTitle().equalsIgnoreCase("New Chat") || conv.getTitle().equalsIgnoreCase("New Conversation")) {
                    conv.setTitle(generateTitleFromPrompt(content));
                }
            }
            conv.setUpdatedAt(Instant.now().toString());
            saveToDisk();
        }
    }

    public boolean updateMessage(String conversationId, String messageId, String newContent) {
        Conversation conv = storage.get(conversationId);
        if (conv == null || conv.getMessages() == null) return false;

        boolean found = false;
        for (int i = 0; i < conv.getMessages().size(); i++) {
            Map<String, Object> msg = conv.getMessages().get(i);
            if (messageId.equals(msg.get("id"))) {
                Map<String, Object> mutableMsg = new LinkedHashMap<>(msg);
                mutableMsg.put("content", newContent);
                mutableMsg.put("updatedAt", Instant.now().toString());
                conv.getMessages().set(i, mutableMsg);
                found = true;
                break;
            }
        }
        if (found) {
            if (!conv.getMessages().isEmpty()) {
                Map<String, Object> last = conv.getMessages().get(conv.getMessages().size() - 1);
                String lastContent = (String) last.get("content");
                if (lastContent != null) {
                    conv.setLastMessagePreview(lastContent.length() > 60 ? lastContent.substring(0, 60) + "..." : lastContent);
                }
            }
            conv.setUpdatedAt(Instant.now().toString());
            saveToDisk();
        }
        return found;
    }

    public void updateLastMessageLanguage(String conversationId, String language) {
        Conversation conv = storage.get(conversationId);
        if (conv == null || conv.getMessages() == null || conv.getMessages().isEmpty()) return;
        Map<String, Object> last = conv.getMessages().get(conv.getMessages().size() - 1);
        if ("assistant".equalsIgnoreCase((String) last.get("role"))) {
            Map<String, Object> mutable = new LinkedHashMap<>(last);
            mutable.put("language", language);
            conv.getMessages().set(conv.getMessages().size() - 1, mutable);
            saveToDisk();
        }
    }

    public boolean replaceMessages(String conversationId, List<Map<String, Object>> newMessages) {
        Conversation conv = storage.get(conversationId);
        if (conv == null) return false;

        List<Map<String, Object>> mutableList = new ArrayList<>();
        if (newMessages != null) {
            for (Map<String, Object> m : newMessages) {
                mutableList.add(new LinkedHashMap<>(m));
            }
        }
        conv.setMessages(mutableList);
        if (!mutableList.isEmpty()) {
            Map<String, Object> last = mutableList.get(mutableList.size() - 1);
            String lastContent = (String) last.get("content");
            if (lastContent != null) {
                conv.setLastMessagePreview(lastContent.length() > 60 ? lastContent.substring(0, 60) + "..." : lastContent);
            }
        } else {
            conv.setLastMessagePreview("");
        }
        conv.setUpdatedAt(Instant.now().toString());
        saveToDisk();
        return true;
    }

    public boolean deleteConversation(String id) {
        boolean removed = (storage.remove(id) != null);
        if (removed) {
            saveToDisk();
            if (kgStorage != null) {
                try {
                    kgStorage.removeSourceFromGraph("conversation", id);
                } catch (Exception ignored) {}
            }
        }
        return removed;
    }

    public void clearAll() {
        storage.clear();
        saveToDisk();
        if (kgStorage != null) {
            try {
                kgStorage.clearAll();
            } catch (Exception ignored) {}
        }
    }

    public List<Map<String, Object>> getHighlights(String conversationId) {
        Conversation conv = storage.get(conversationId);
        if (conv == null || conv.getHighlights() == null) {
            return Collections.emptyList();
        }
        return new ArrayList<>(conv.getHighlights());
    }

    public Map<String, Object> addOrUpdateHighlight(String conversationId, Map<String, Object> highlight) {
        if (conversationId == null || highlight == null) return null;
        Conversation conv = storage.get(conversationId);
        if (conv == null) {
            conv = new Conversation(conversationId, "New Chat", "auto",
                    Instant.now().toString(), Instant.now().toString());
            storage.put(conversationId, conv);
        }

        if (conv.getHighlights() == null) {
            conv.setHighlights(new ArrayList<>());
        }

        Map<String, Object> mutableHl = new LinkedHashMap<>(highlight);
        String id = (String) mutableHl.get("id");
        if (id == null || id.isBlank()) {
            id = "hl-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6);
            mutableHl.put("id", id);
        }
        if (!mutableHl.containsKey("createdAt")) {
            mutableHl.put("createdAt", Instant.now().toString());
        }
        mutableHl.put("conversationId", conversationId);

        boolean found = false;
        for (int i = 0; i < conv.getHighlights().size(); i++) {
            Map<String, Object> existing = conv.getHighlights().get(i);
            if (id.equals(existing.get("id"))) {
                conv.getHighlights().set(i, mutableHl);
                found = true;
                break;
            }
        }
        if (!found) {
            conv.getHighlights().add(mutableHl);
        }

        conv.setUpdatedAt(Instant.now().toString());
        saveToDisk();
        return mutableHl;
    }

    public boolean removeHighlight(String conversationId, String highlightId) {
        Conversation conv = storage.get(conversationId);
        if (conv == null || conv.getHighlights() == null || highlightId == null) return false;
        boolean removed = conv.getHighlights().removeIf(h -> highlightId.equals(h.get("id")));
        if (removed) {
            conv.setUpdatedAt(Instant.now().toString());
            saveToDisk();
        }
        return removed;
    }

    public boolean clearHighlights(String conversationId, String messageId) {
        Conversation conv = storage.get(conversationId);
        if (conv == null || conv.getHighlights() == null) return false;
        boolean removed;
        if (messageId != null && !messageId.isBlank()) {
            removed = conv.getHighlights().removeIf(h -> messageId.equals(h.get("messageId")));
        } else {
            removed = !conv.getHighlights().isEmpty();
            conv.getHighlights().clear();
        }
        if (removed) {
            conv.setUpdatedAt(Instant.now().toString());
            saveToDisk();
        }
        return removed;
    }

    /**
     * Searches previous conversations (excluding current) to extract relevant context,
     * code snippets, error traces, and decisions.
     */
    public List<com.coderarmy.ragsupport.model.PastConversationExcerpt> findRelevantPastConversations(String currentConvId, String query, int maxResults) {
        if (query == null || query.isBlank() || storage.isEmpty()) {
            return Collections.emptyList();
        }

        Set<String> queryTokens = tokenize(query);
        if (queryTokens.isEmpty()) return Collections.emptyList();

        List<com.coderarmy.ragsupport.model.PastConversationExcerpt> excerpts = new ArrayList<>();
        String queryLower = query.toLowerCase();

        for (Conversation conv : storage.values()) {
            if (conv.getId() == null || conv.getId().equals(currentConvId)) {
                continue; // Skip the active conversation
            }

            List<Map<String, Object>> msgs = conv.getMessages();
            if (msgs == null || msgs.isEmpty()) continue;

            for (int i = 0; i < msgs.size(); i++) {
                Map<String, Object> m = msgs.get(i);
                String role = (String) m.get("role");
                String content = (String) m.get("content");
                if (content == null || content.isBlank()) continue;

                Set<String> msgTokens = tokenize(content);
                long overlap = msgTokens.stream().filter(queryTokens::contains).count();
                if (overlap == 0) continue;

                double score = (double) overlap / Math.max(queryTokens.size(), 4);

                boolean hasCode = content.contains("```") || content.contains("def ") || content.contains("class ") || content.contains("public ");
                if (hasCode && (queryLower.contains("code") || queryLower.contains("file") || queryLower.contains("implement") || queryLower.contains("how to"))) {
                    score += 0.25;
                }

                boolean hasError = content.toLowerCase().contains("error") || content.toLowerCase().contains("exception") || content.toLowerCase().contains("failed") || content.toLowerCase().contains("bug");
                if (hasError && (queryLower.contains("error") || queryLower.contains("fix") || queryLower.contains("solve") || queryLower.contains("issue") || queryLower.contains("bug"))) {
                    score += 0.30;
                }

                if (score >= 0.20) {
                    String userContext = "";
                    String assistantContext = content;

                    if ("user".equalsIgnoreCase(role)) {
                        userContext = content;
                        if (i + 1 < msgs.size() && "assistant".equalsIgnoreCase((String) msgs.get(i + 1).get("role"))) {
                            assistantContext = (String) msgs.get(i + 1).get("content");
                        }
                    } else if ("assistant".equalsIgnoreCase(role) && i > 0) {
                        userContext = (String) msgs.get(i - 1).get("content");
                    }

                    String cleanExcerpt = assistantContext != null ? assistantContext.trim() : "";
                    if (cleanExcerpt.length() > 450) {
                        cleanExcerpt = cleanExcerpt.substring(0, 447) + "...";
                    }

                    String cleanUser = userContext != null ? userContext.trim() : "";
                    if (cleanUser.length() > 180) {
                        cleanUser = cleanUser.substring(0, 177) + "...";
                    }

                    excerpts.add(new com.coderarmy.ragsupport.model.PastConversationExcerpt(
                            conv.getId(),
                            conv.getTitle(),
                            (String) m.getOrDefault("id", "msg-" + i),
                            (String) m.getOrDefault("createdAt", conv.getUpdatedAt()),
                            cleanUser,
                            cleanExcerpt,
                            score,
                            hasCode,
                            hasError
                    ));
                }
            }
        }

        return excerpts.stream()
                .sorted((a, b) -> Double.compare(b.getRelevanceScore(), a.getRelevanceScore()))
                .limit(maxResults)
                .collect(Collectors.toList());
    }

    private static final Set<String> STOP_WORDS = Set.of(
            "a", "an", "the", "and", "or", "is", "are", "was", "were", "to", "for", "in", "on", "with",
            "at", "by", "of", "about", "what", "how", "can", "you", "tell", "me", "i", "we", "my", "our",
            "please", "help", "do", "does", "did", "this", "that", "these", "those", "have", "has", "had"
    );

    private Set<String> tokenize(String text) {
        if (text == null) return Collections.emptySet();
        String[] words = text.toLowerCase().replaceAll("[^a-z0-9\\s]", " ").split("\\s+");
        Set<String> set = new HashSet<>();
        for (String w : words) {
            if (w.length() >= 3 && !STOP_WORDS.contains(w)) {
                set.add(w);
            }
        }
        return set;
    }
}
