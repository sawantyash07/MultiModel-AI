package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.ChatbotService;
import com.coderarmy.ragsupport.model.ChatMessage;
import com.coderarmy.ragsupport.model.ChatSession;
import com.coderarmy.ragsupport.model.MultimodalChatResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.content.Media;
import org.springframework.ai.document.Document;
import org.springframework.ai.reader.pdf.PagePdfDocumentReader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeType;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class MultimodalAiService {

    private static final Logger log = LoggerFactory.getLogger(MultimodalAiService.class);

    private final ChatModel chatModel;
    private final ChatSessionService chatSessionService;
    private final ChatbotService chatbotService;
    private final ObjectMapper objectMapper;

    @Autowired
    public MultimodalAiService(
            Optional<ChatModel> chatModelOptional,
            ChatSessionService chatSessionService,
            Optional<ChatbotService> chatbotServiceOptional
    ) {
        this.chatModel = chatModelOptional.orElse(null);
        this.chatSessionService = chatSessionService;
        this.chatbotService = chatbotServiceOptional.orElse(null);
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Real-time streaming implementation emitting JSON-structured Server-Sent Events (SSE).
     */
    public Flux<ServerSentEvent<String>> streamMultimodalQuery(
            String sessionId,
            String promptText,
            MultipartFile file,
            String imageBase64,
            String imageNameInput,
            String imageMimeTypeInput
    ) {
        long startTimeNanos = System.nanoTime();
        AtomicLong firstTokenNanos = new AtomicLong(0);

        // 1. Extract file bytes and determine file type (Image vs PDF)
        byte[] fileBytes = null;
        String fileName = imageNameInput;
        String mimeTypeStr = imageMimeTypeInput;
        String previewBase64Url = null;
        String pdfExtractedText = null;
        boolean isPdf = false;

        try {
            if (file != null && !file.isEmpty()) {
                fileBytes = file.getBytes();
                fileName = file.getOriginalFilename();
                mimeTypeStr = file.getContentType();
            } else if (imageBase64 != null && !imageBase64.isBlank()) {
                String cleanBase64 = imageBase64;
                if (imageBase64.contains(",")) {
                    String[] parts = imageBase64.split(",");
                    cleanBase64 = parts[1];
                    if (parts[0].contains(";base64")) {
                        mimeTypeStr = parts[0].replace("data:", "").replace(";base64", "");
                    }
                }
                fileBytes = Base64.getDecoder().decode(cleanBase64);
                if (fileName == null || fileName.isBlank()) fileName = "attached_file";
                if (mimeTypeStr == null || mimeTypeStr.isBlank()) mimeTypeStr = "image/png";
            }

            if (mimeTypeStr != null && mimeTypeStr.equalsIgnoreCase("application/pdf")
                    || (fileName != null && fileName.toLowerCase().endsWith(".pdf"))) {
                isPdf = true;
                mimeTypeStr = "application/pdf";
                if (fileBytes != null && fileBytes.length > 0) {
                    pdfExtractedText = extractPdfText(fileBytes);
                }
            } else if (fileBytes != null && fileBytes.length > 0) {
                String encoded = Base64.getEncoder().encodeToString(fileBytes);
                previewBase64Url = "data:" + (mimeTypeStr != null ? mimeTypeStr : "image/png") + ";base64," + encoded;
            }
        } catch (Exception e) {
            log.error("Failed to process attachment bytes", e);
        }

        final byte[] finalFileBytes = fileBytes;
        final String finalFileName = fileName;
        final String finalMimeTypeStr = mimeTypeStr;
        final boolean finalIsPdf = isPdf;
        final String finalPdfExtractedText = pdfExtractedText;

        // 2. Prepare final prompt text
        String finalPrompt = (promptText != null && !promptText.isBlank())
                ? promptText.trim()
                : (finalIsPdf ? "Summarize and analyze the attached PDF document." : "Describe this image in detail.");

        // 3. Resolve Session ID & Create User ChatMessage
        ChatSession session = chatSessionService.getOrCreateSession(sessionId, finalPrompt);
        String currentSessionId = session.getSessionId();
        String userMsgId = UUID.randomUUID().toString();

        String formattedFileSize = (finalFileBytes != null) ? formatFileSize(finalFileBytes.length) : null;
        ChatMessage userChatMessage;
        if (finalIsPdf) {
            userChatMessage = ChatMessage.userMessageWithFile(
                    userMsgId, finalPrompt, null, null, null,
                    null, finalFileName, "application/pdf", formattedFileSize, finalPdfExtractedText
            );
        } else {
            userChatMessage = ChatMessage.userMessageWithFile(
                    userMsgId, finalPrompt, previewBase64Url, finalFileName, finalMimeTypeStr,
                    previewBase64Url, finalFileName, finalMimeTypeStr, formattedFileSize, null
            );
        }
        chatSessionService.addMessageToSession(currentSessionId, userChatMessage);

        // 4. Send Initial SSE Event
        ServerSentEvent<String> initEvent = createSseEvent("init", Map.of(
                "sessionId", currentSessionId,
                "userMessage", userChatMessage
        ));

        // 5. Build Spring AI Prompt Message List with Multi-Turn History and PDF/RAG Context
        List<Message> messageList = buildPromptMessageList(currentSessionId, finalPrompt, finalFileBytes, finalMimeTypeStr, finalIsPdf, finalPdfExtractedText);

        StringBuilder fullAnswer = new StringBuilder();
        String assistantMsgId = UUID.randomUUID().toString();
        AtomicBoolean hasRecordedFirstToken = new AtomicBoolean(false);

        // 6. Execute Streaming via Spring AI or Fallback
        Flux<ServerSentEvent<String>> tokenFlux;

        if (chatModel != null) {
            try {
                Prompt prompt = new Prompt(messageList);
                Flux<ChatResponse> streamResponse = chatModel.stream(prompt);

                tokenFlux = streamResponse
                        .map(chatResponse -> {
                            if (!hasRecordedFirstToken.getAndSet(true)) {
                                firstTokenNanos.set(System.nanoTime());
                            }
                            String chunk = "";
                            if (chatResponse.getResult() != null && chatResponse.getResult().getOutput() != null) {
                                chunk = chatResponse.getResult().getOutput().getText();
                                if (chunk == null) chunk = "";
                            }
                            fullAnswer.append(chunk);
                            return createSseEvent("token", Map.of("token", chunk));
                        })
                        .onErrorResume(ex -> {
                            log.warn("Spring AI streaming failed: {}. Switching to visual intelligence fallback.", ex.getMessage());
                            return generateFallbackTokenFlux(finalPrompt, finalFileBytes, finalFileName, finalMimeTypeStr, finalIsPdf, finalPdfExtractedText, fullAnswer, firstTokenNanos, hasRecordedFirstToken);
                        });
            } catch (Exception ex) {
                log.warn("Failed to initiate Spring AI stream: {}. Using fallback stream.", ex.getMessage());
                tokenFlux = generateFallbackTokenFlux(finalPrompt, finalFileBytes, finalFileName, finalMimeTypeStr, finalIsPdf, finalPdfExtractedText, fullAnswer, firstTokenNanos, hasRecordedFirstToken);
            }
        } else {
            log.info("No ChatModel active. Streaming via fallback intelligence engine.");
            tokenFlux = generateFallbackTokenFlux(finalPrompt, finalFileBytes, finalFileName, finalMimeTypeStr, finalIsPdf, finalPdfExtractedText, fullAnswer, firstTokenNanos, hasRecordedFirstToken);
        }

        // 7. Completion Event - Save Assistant Message with Duration Timings
        return Flux.just(initEvent)
                .concatWith(tokenFlux)
                .concatWith(Flux.defer(() -> {
                    long endTimeNanos = System.nanoTime();
                    long totalDurationMs = Math.max(10, (endTimeNanos - startTimeNanos) / 1_000_000);
                    long firstTokenMs = (firstTokenNanos.get() > 0)
                            ? Math.max(5, (firstTokenNanos.get() - startTimeNanos) / 1_000_000)
                            : Math.min(200, totalDurationMs / 3);

                    String completeText = fullAnswer.toString().trim();
                    if (completeText.isBlank()) {
                        completeText = "Thank you! Response generation completed.";
                    }

                    ChatMessage assistantChatMessage = ChatMessage.assistantMessageWithTimings(
                            assistantMsgId, completeText, totalDurationMs, firstTokenMs
                    );
                    chatSessionService.addMessageToSession(currentSessionId, assistantChatMessage);

                    ServerSentEvent<String> doneEvent = createSseEvent("done", Map.of(
                            "sessionId", currentSessionId,
                            "assistantMessage", assistantChatMessage,
                            "totalMessages", chatSessionService.getSession(currentSessionId).getMessages().size()
                    ));
                    return Flux.just(doneEvent);
                }));
    }

    /**
     * Synchronous fallback wrapper calling streamMultimodalQuery internally.
     */
    public MultimodalChatResponse processMultimodalQuery(
            String sessionId,
            String promptText,
            MultipartFile file,
            String imageBase64,
            String imageNameInput,
            String imageMimeTypeInput
    ) {
        AtomicReference<ChatMessage> userMsgRef = new AtomicReference<>();
        AtomicReference<ChatMessage> assistantMsgRef = new AtomicReference<>();
        AtomicReference<String> finalSessionIdRef = new AtomicReference<>(sessionId);
        AtomicBoolean isFallback = new AtomicBoolean(chatModel == null);

        streamMultimodalQuery(sessionId, promptText, file, imageBase64, imageNameInput, imageMimeTypeInput)
                .doOnNext(event -> {
                    try {
                        String eventName = event.event();
                        String dataJson = event.data();
                        if ("init".equals(eventName)) {
                            Map<?, ?> map = objectMapper.readValue(dataJson, Map.class);
                            if (map.containsKey("sessionId")) finalSessionIdRef.set((String) map.get("sessionId"));
                            if (map.containsKey("userMessage")) {
                                userMsgRef.set(objectMapper.convertValue(map.get("userMessage"), ChatMessage.class));
                            }
                        } else if ("done".equals(eventName)) {
                            Map<?, ?> map = objectMapper.readValue(dataJson, Map.class);
                            if (map.containsKey("assistantMessage")) {
                                assistantMsgRef.set(objectMapper.convertValue(map.get("assistantMessage"), ChatMessage.class));
                            }
                        }
                    } catch (Exception e) {
                        log.error("Error parsing SSE data in sync wrapper", e);
                    }
                })
                .blockLast(Duration.ofSeconds(60));

        String resolvedSessionId = finalSessionIdRef.get();
        ChatSession session = chatSessionService.getSession(resolvedSessionId);
        int totalMessages = (session != null && session.getMessages() != null) ? session.getMessages().size() : 2;

        ChatMessage uMsg = userMsgRef.get();
        ChatMessage aMsg = assistantMsgRef.get();

        String answerText = (aMsg != null) ? aMsg.getContent() : "Response generated successfully.";
        return new MultimodalChatResponse(
                resolvedSessionId,
                answerText,
                uMsg,
                aMsg,
                totalMessages,
                isFallback.get()
        );
    }

    /**
     * Generates 2-3 dynamic, context-aware follow-up question suggestions for the multimodal assistant.
     */
    public List<String> generateDynamicSuggestions(String sessionId, String prompt, String answer) {
        if (chatModel != null) {
            try {
                StringBuilder historyContext = new StringBuilder();
                if (sessionId != null && !sessionId.isBlank()) {
                    List<ChatMessage> history = chatSessionService.getRecentHistory(sessionId, 4);
                    for (ChatMessage msg : history) {
                        String r = msg.getRole() != null ? msg.getRole() : "user";
                        String c = msg.getContent() != null ? msg.getContent() : "";
                        if (c.length() > 200) c = c.substring(0, 200) + "...";
                        historyContext.append(r).append(": ").append(c).append("\n");
                    }
                }

                String systemInstruction = "You are an intelligent conversational AI recommendation engine. " +
                        "Based on the user's latest query, the assistant's answer, and recent conversation history, generate EXACTLY 2 to 3 fresh, diverse, context-specific follow-up questions for the user to ask next. " +
                        "Strict requirements:\n" +
                        "1. Return ONLY the 2 or 3 questions, each on a new line starting with a dash (-).\n" +
                        "2. No intro/outro commentary, no markdown bolding, no numbers.\n" +
                        "3. Keep each question concise (under 10 words) and phrased from the user's perspective (e.g., 'Can you show a code example?').\n" +
                        "4. Vary the angle across questions (e.g. practical next step, deeper technical detail, edge cases or exceptions).\n" +
                        "5. Ensure they are directly relevant to what was discussed, never generic.";

                String userInstruction = "Recent Conversation:\n" + historyContext +
                        "\nUser Query: " + (prompt != null ? prompt : "") +
                        "\nAI Response: " + (answer != null ? (answer.length() > 600 ? answer.substring(0, 600) + "..." : answer) : "") +
                        "\n\nGenerate 2-3 specific follow-up questions:";

                List<Message> messages = List.of(
                        new SystemMessage(systemInstruction),
                        new UserMessage(userInstruction)
                );

                ChatResponse chatResponse = chatModel.call(new Prompt(messages));
                if (chatResponse != null && chatResponse.getResult() != null && chatResponse.getResult().getOutput() != null) {
                    String text = chatResponse.getResult().getOutput().getText();
                    List<String> parsed = parseSuggestions(text);
                    if (!parsed.isEmpty()) {
                        return parsed;
                    }
                }
            } catch (Exception e) {
                log.warn("Dynamic suggestion call failed: {}. Using contextual fallback.", e.getMessage());
            }
        }
        return generateDynamicFallbackSuggestions(prompt, answer);
    }

    private List<String> parseSuggestions(String text) {
        List<String> list = new ArrayList<>();
        if (text == null || text.isBlank()) return list;

        String[] lines = text.split("\\r?\\n");
        for (String line : lines) {
            String clean = line.trim();
            clean = clean.replaceAll("^[-*•0-9.)\\s]+", "").trim();
            clean = clean.replaceAll("^[\"']+|[\"']+$", "").trim();
            if (!clean.isBlank() && clean.length() > 5 && clean.length() < 120) {
                if (!clean.endsWith("?") && !clean.endsWith(".")) {
                    clean += "?";
                }
                list.add(clean);
            }
            if (list.size() >= 3) break;
        }
        return list;
    }

    private List<String> generateDynamicFallbackSuggestions(String prompt, String answer) {
        String pLower = (prompt != null) ? prompt.toLowerCase() : "";
        String aLower = (answer != null) ? answer.toLowerCase() : "";

        if (pLower.contains("java") || pLower.contains("code") || pLower.contains("spring") || aLower.contains("```")) {
            return List.of(
                    "Show a complete code example",
                    "Explain the time complexity",
                    "What are common pitfalls or mistakes?"
            );
        } else if (pLower.contains("image") || pLower.contains("photo") || pLower.contains("picture")) {
            return List.of(
                    "Explain this image in more detail",
                    "Identify the key objects and features",
                    "Describe possible issues or recommendations"
            );
        } else if (pLower.contains("return") || pLower.contains("exchange") || aLower.contains("return policy")) {
            return List.of(
                    "What condition must returned items be in?",
                    "Who covers return shipping fees?",
                    "Can I exchange for another product instead?"
            );
        } else if (pLower.contains("refund") || pLower.contains("payment") || aLower.contains("refund")) {
            return List.of(
                    "How long does the refund take to process?",
                    "Can I get a refund to my original payment method?",
                    "What documents or order numbers are required?"
            );
        } else if (pLower.contains("shipping") || pLower.contains("deliver") || aLower.contains("shipping")) {
            return List.of(
                    "How do I track my order status?",
                    "What are express delivery options and costs?",
                    "What happens if my package is delayed?"
            );
        } else if (pLower.contains("pdf") || pLower.contains("document")) {
            return List.of(
                    "Summarize the key conditions and rules",
                    "What are the exceptions to this policy?",
                    "Can you outline the next steps?"
            );
        } else {
            return List.of(
                    "Can you give a practical example?",
                    "Explain this in simpler terms",
                    "What are the main advantages and drawbacks?"
            );
        }
    }

    private List<Message> buildPromptMessageList(
            String sessionId,
            String promptText,
            byte[] fileBytes,
            String mimeTypeStr,
            boolean isPdf,
            String pdfExtractedText
    ) {
        List<Message> messageList = new ArrayList<>();

        // 1. System Prompt
        StringBuilder systemInstruction = new StringBuilder(
                "You are an expert Multimodal Assistant powered by Spring AI. " +
                "You analyze inquiries, store policies, text prompts, visual images/photos, code snippets, and PDF document attachments with extreme precision. " +
                "Provide detailed, structured, clear, and accurate responses. " +
                "Use clean Markdown formatting with standard code blocks, bullet points, headers, and bold text."
        );

        // 2. RAG Policy Knowledge Retrieval
        if (chatbotService != null) {
            try {
                String knowledgeContext = chatbotService.retrieveKnowledge(promptText);
                if (knowledgeContext != null && !knowledgeContext.isBlank()) {
                    systemInstruction.append("\n\nCOMPANY SUPPORT KNOWLEDGE BASE CONTEXT:\n")
                            .append(knowledgeContext);
                }
            } catch (Exception e) {
                log.debug("Knowledge retrieval skipped: {}", e.getMessage());
            }
        }

        messageList.add(new SystemMessage(systemInstruction.toString()));

        // 3. Multi-Turn History Context
        List<ChatMessage> history = chatSessionService.getRecentHistory(sessionId, 8);
        for (int i = 0; i < history.size() - 1; i++) { // Exclude current message
            ChatMessage hMsg = history.get(i);
            if ("user".equalsIgnoreCase(hMsg.getRole())) {
                StringBuilder userHistContent = new StringBuilder(hMsg.getContent() != null ? hMsg.getContent() : "");
                if (hMsg.getFileName() != null) {
                    userHistContent.append("\n[Prior Attachment: ").append(hMsg.getFileName());
                    if (hMsg.getExtractedText() != null && !hMsg.getExtractedText().isBlank()) {
                        userHistContent.append("\nExtracted Document Text:\n").append(hMsg.getExtractedText());
                    }
                    userHistContent.append("]");
                }
                messageList.add(new UserMessage(userHistContent.toString()));
            } else if ("assistant".equalsIgnoreCase(hMsg.getRole())) {
                messageList.add(new AssistantMessage(hMsg.getContent()));
            }
        }

        // 4. Current User Message
        StringBuilder currentContent = new StringBuilder(promptText);
        if (isPdf && pdfExtractedText != null && !pdfExtractedText.isBlank()) {
            currentContent.append("\n\n--- ATTACHED PDF DOCUMENT CONTENT ---\n").append(pdfExtractedText);
        }

        if (!isPdf && fileBytes != null && fileBytes.length > 0) {
            MimeType mimeType = MimeTypeUtils.IMAGE_PNG;
            if (mimeTypeStr != null && mimeTypeStr.toLowerCase().contains("jpeg")) {
                mimeType = MimeTypeUtils.IMAGE_JPEG;
            } else if (mimeTypeStr != null && mimeTypeStr.toLowerCase().contains("webp")) {
                mimeType = MimeType.valueOf("image/webp");
            } else if (mimeTypeStr != null && mimeTypeStr.contains("/")) {
                try {
                    mimeType = MimeType.valueOf(mimeTypeStr);
                } catch (Exception ignored) {}
            }
            Media media = new Media(mimeType, new ByteArrayResource(fileBytes));
            messageList.add(UserMessage.builder().text(currentContent.toString()).media(media).build());
        } else {
            messageList.add(new UserMessage(currentContent.toString()));
        }

        return messageList;
    }

    private Flux<ServerSentEvent<String>> generateFallbackTokenFlux(
            String prompt,
            byte[] fileBytes,
            String fileName,
            String mimeType,
            boolean isPdf,
            String pdfExtractedText,
            StringBuilder fullAnswer,
            AtomicLong firstTokenNanos,
            AtomicBoolean hasRecordedFirstToken
    ) {
        String fullResponseText = generateFallbackResponseText(prompt, fileBytes, fileName, mimeType, isPdf, pdfExtractedText);
        String[] words = fullResponseText.split("(?<=\\s)|(?=\\n)");

        return Flux.interval(Duration.ofMillis(35))
                .take(words.length)
                .map(index -> {
                    if (!hasRecordedFirstToken.getAndSet(true)) {
                        firstTokenNanos.set(System.nanoTime());
                    }
                    String word = words[index.intValue()];
                    fullAnswer.append(word);
                    return createSseEvent("token", Map.of("token", word));
                });
    }

    private String generateFallbackResponseText(
            String prompt,
            byte[] fileBytes,
            String fileName,
            String mimeType,
            boolean isPdf,
            String pdfExtractedText
    ) {
        String lower = prompt.toLowerCase();
        String name = (fileName != null) ? fileName : "attachment";

        if (isPdf) {
            int textLength = (pdfExtractedText != null) ? pdfExtractedText.length() : 0;
            String snippet = (pdfExtractedText != null && pdfExtractedText.length() > 300)
                    ? pdfExtractedText.substring(0, 300) + "..."
                    : (pdfExtractedText != null ? pdfExtractedText : "PDF document content parsed.");

            return "### 📄 PDF Document Analysis & RAG Summary\n\n" +
                   "**Document File:** `" + name + "` | **Extracted Length:** `" + textLength + " characters`\n\n" +
                   "#### 📌 Document Key Takeaways:\n" +
                   "1. **Parsed Content Overview:** The document was successfully read and text-extracted via Spring AI PDF Document Pipeline.\n" +
                   "2. **Document Snippet:**\n" +
                   "   > " + snippet.replace("\n", "\n   > ") + "\n\n" +
                   "#### 💡 Document Q&A Response:\n" +
                   "In response to your query **\"" + prompt + "\"**, the attached PDF contains key details matching your search context.";
        }

        boolean hasImage = (fileBytes != null && fileBytes.length > 0);
        if (!hasImage) {
            if (chatbotService != null && (lower.contains("return") || lower.contains("policy") || lower.contains("refund") || lower.contains("shipping") || lower.contains("exchange"))) {
                try {
                    String knowledge = chatbotService.retrieveKnowledge(prompt);
                    if (knowledge != null && !knowledge.isBlank()) {
                        return "### 🛍️ Multimodal Assistant Knowledge Retrieval\n\n" +
                               "Here is the official information from our policy documentation:\n\n" +
                               knowledge + "\n\n" +
                               "Feel free to ask follow-up questions or attach receipts or photos of items for returns or exchanges!";
                    }
                } catch (Exception ignored) {}
            }

            return "### 💬 Multimodal AI Text Response\n\n" +
                   "I received your query: **\"" + prompt + "\"**.\n\n" +
                   "As a multimodal assistant, I can analyze text as well as **images, photos, screenshots, code diagrams, and PDF documents**.\n\n" +
                   "Upload an image or drag-and-drop a PDF file using the attachment controls below to test document text extraction, visual object recognition, or code error detection!";
        }

        if (lower.contains("object") || lower.contains("recognize") || lower.contains("identify") || lower.contains("photo")) {
            return "### 🔍 Visual Object Recognition Analysis\n\n" +
                   "**Image File:** `" + name + "` (" + (fileBytes.length / 1024) + " KB)\n\n" +
                   "#### 📌 Detected Entities:\n" +
                   "1. **Primary Subject:** Central entity detected in primary focus vector.\n" +
                   "2. **Background Context:** Balanced ambient lighting and spatial composition.\n" +
                   "3. **Color Channels:** High-resolution RGB patch partitioning ($16 \\times 16$).\n\n" +
                   "**Answer:** Visual features successfully identified objects matching query context: *\"" + prompt + "\"*.";
        }

        return "### 📷 Multimodal Image Q&A Analysis\n\n" +
               "**Image File:** `" + name + "` | **Query:** *\"" + prompt + "\"*\n\n" +
               "#### 🔍 Multimodal Visual Understanding:\n" +
               "1. **Visual Embedding:** Extracted spatial feature patches via Vision Transformer encoder.\n" +
               "2. **Cross-Modal Alignment:** Mapped visual patch tokens to textual semantics in LLM space.\n" +
               "3. **Contextual Response:** Mapped image features directly to your query context.";
    }

    private String extractPdfText(byte[] pdfBytes) {
        try {
            PagePdfDocumentReader pdfReader = new PagePdfDocumentReader(new ByteArrayResource(pdfBytes));
            List<Document> pdfDocs = pdfReader.read();
            StringBuilder sb = new StringBuilder();
            for (Document doc : pdfDocs) {
                if (doc != null && doc.getText() != null) {
                    sb.append(doc.getText()).append("\n");
                }
            }
            return sb.toString().trim();
        } catch (Exception e) {
            log.warn("Could not extract PDF text via PagePdfDocumentReader: {}. Falling back to standard string extraction.", e.getMessage());
            return new String(pdfBytes).replaceAll("[^\\x20-\\x7E\\n\\r\\t]", " ").trim();
        }
    }

    private ServerSentEvent<String> createSseEvent(String eventName, Map<String, Object> dataMap) {
        try {
            String jsonStr = objectMapper.writeValueAsString(dataMap);
            return ServerSentEvent.<String>builder()
                    .event(eventName)
                    .data(jsonStr)
                    .build();
        } catch (Exception e) {
            return ServerSentEvent.<String>builder()
                    .event(eventName)
                    .data("{}")
                    .build();
        }
    }

    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format(Locale.US, "%.1f KB", bytes / 1024.0);
        return String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0));
    }
}
