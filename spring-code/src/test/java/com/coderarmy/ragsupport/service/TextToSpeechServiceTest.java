package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.TtsRequest;
import com.coderarmy.ragsupport.service.provider.ProviderRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class TextToSpeechServiceTest {

    private TextToSpeechService ttsService;
    private HfIndicParlerTtsClient mockHfClient;
    private BodhanIndicSpeakClient mockBodhanClient;
    private TranslationService mockTranslationService;

    @BeforeEach
    void setUp() {
        ProviderRegistry registry = Mockito.mock(ProviderRegistry.class);
        mockHfClient = Mockito.mock(HfIndicParlerTtsClient.class);
        mockBodhanClient = Mockito.mock(BodhanIndicSpeakClient.class);
        mockTranslationService = Mockito.spy(new TranslationService(null, null));

        when(mockHfClient.isAvailable()).thenReturn(true);
        when(mockHfClient.getSpeakerForLanguage(anyString()))
                .thenReturn(new HfIndicParlerTtsClient.SpeakerProfile("Rohit", "Rohit speaks clearly"));

        ttsService = new TextToSpeechService(registry, null, null, null, mockHfClient, mockBodhanClient, mockTranslationService);
    }

    @Test
    void testNormalizeLanguageCode() {
        assertEquals("en", ttsService.normalizeLanguageCode("en"));
        assertEquals("en", ttsService.normalizeLanguageCode("English"));
        assertEquals("en", ttsService.normalizeLanguageCode(null));
        assertEquals("en", ttsService.normalizeLanguageCode(""));

        assertEquals("hi", ttsService.normalizeLanguageCode("hi"));
        assertEquals("hi", ttsService.normalizeLanguageCode("hindi"));
        assertEquals("hi", ttsService.normalizeLanguageCode("हिंदी"));

        assertEquals("mr", ttsService.normalizeLanguageCode("mr"));
        assertEquals("mr", ttsService.normalizeLanguageCode("marathi"));
        assertEquals("mr", ttsService.normalizeLanguageCode("मराठी"));
    }

    @Test
    void testDetectLanguage() {
        assertEquals("en", ttsService.detectLanguage("Hello! Today, I will explain how AI works."));
        assertEquals("hi", ttsService.detectLanguage("नमस्ते! आज मैं समझाऊँगा कि कृत्रिम बुद्धिमत्ता कैसे मदद कर सकती है।"));
        assertEquals("mr", ttsService.detectLanguage("नमस्कार! आज मी कृत्रिम बुद्धिमत्ता कशी मदत करू शकते हे सांगणार आहे।"));
        assertEquals("bn", ttsService.detectLanguage("নমস্কার, কৃত্রিম বুদ্ধিমত্তা আপনাকে সাহায্য করতে পারে।"));
        assertEquals("ta", ttsService.detectLanguage("செயற்கை நுண்ணறிவு கணினிகளைப் பயிற்றுவிக்கும் தொழில்நுட்பமாகும்."));
        assertEquals("te", ttsService.detectLanguage("కృత్రిమ మేధస్సు కంప్యూటర్ సైన్స్ విభాగం."));
        assertEquals("gu", ttsService.detectLanguage("કૃત્રિમ બુદ્ધિ કમ્પ્યુટર વિજ્ઞાનની એક શાખા છે."));
    }

    @Test
    void testIsMatchingScript() {
        assertTrue(ttsService.isMatchingScript("Hello world from Yash AI", "en"));
        assertFalse(ttsService.isMatchingScript("नमस्ते दुनिया", "en"));

        assertTrue(ttsService.isMatchingScript("नमस्ते! आज मैं समझाऊँगा कि AI कैसे काम करता है।", "hi"));
        assertTrue(ttsService.isMatchingScript("नमस्कार! आज मी AI कसे कार्य करते हे सांगणार आहे।", "mr"));
        assertTrue(ttsService.isMatchingScript("নমস্কার! এআই কিভাবে কাজ করে।", "bn"));
        assertTrue(ttsService.isMatchingScript("வணக்கம்! செயற்கை நுண்ணறிவு எவ்வாறு செயல்படுகிறது.", "ta"));
        assertTrue(ttsService.isMatchingScript("నమస్కారం! కృత్రిమ మేధస్సు ఎలా పనిచేస్తుంది.", "te"));
        assertTrue(ttsService.isMatchingScript("નમસ્તે! આર્ટિફિશિયલ ઇન્ટેલિજન્સ કેવી રીતે કાર્ય કરે છે.", "gu"));
        assertTrue(ttsService.isMatchingScript("ਨਮਸਤੇ! ਏਆਈ ਕਿਵੇਂ ਕੰਮ ਕਰਦੀ ਹੈ।", "pa"));
        assertTrue(ttsService.isMatchingScript("خوش آمدید، اے آئی کس तरह काम करती ہے۔", "ur"));

        // Negative check: English text does NOT match Hindi or Tamil script
        assertFalse(ttsService.isMatchingScript("This is an English text response.", "hi"));
        assertFalse(ttsService.isMatchingScript("This is an English text response.", "ta"));
    }

    @Test
    void testCleanMarkdownForSpeech() {
        String md = "### Artificial Intelligence\n\n" +
                "Here is an explanation of **AI** and *machine learning*:\n\n" +
                "```python\n" +
                "def hello():\n" +
                "    print('world')\n" +
                "```\n\n" +
                "- Key point 1: Visit [OpenAI](https://openai.com)\n" +
                "- Key point 2: Run `npm run build` command.";

        String cleaned = ttsService.cleanMarkdownForSpeech(md);

        assertFalse(cleaned.contains("```"));
        assertFalse(cleaned.contains("###"));
        assertFalse(cleaned.contains("**"));
        assertFalse(cleaned.contains("*machine"));
        assertFalse(cleaned.contains("https://openai.com"));
        assertTrue(cleaned.contains("Artificial Intelligence"));
        assertTrue(cleaned.contains("AI and machine learning"));
        assertTrue(cleaned.contains("Visit OpenAI"));
        assertTrue(cleaned.contains("npm run build command"));
    }

    @Test
    void testValidationEmptyTextThrows() {
        assertThrows(IllegalArgumentException.class, () -> {
            ttsService.synthesize(new TtsRequest("", "en"));
        });
        assertThrows(IllegalArgumentException.class, () -> {
            ttsService.synthesize(new TtsRequest("   ", "mr"));
        });
        assertThrows(IllegalArgumentException.class, () -> {
            ttsService.synthesize(null);
        });
    }

    @Test
    void testValidationOversizedTextThrows() {
        String hugeText = "a".repeat(5001);
        assertThrows(IllegalArgumentException.class, () -> {
            ttsService.synthesize(new TtsRequest(hugeText, "en"));
        });
    }

    @Test
    void testModelConstants() {
        assertEquals("google/multilingual-tts", TextToSpeechService.MODEL_ID);
        assertEquals("Google Hosted Multilingual Speech Engine", TextToSpeechService.HOSTING_PROVIDER);
        assertEquals(23, TextToSpeechService.SUPPORTED_LANGUAGES.size(), "Must contain all 22 scheduled Indian languages + English");

        // Verify all 22 Scheduled Languages of Eighth Schedule are present
        String[] scheduled22 = {
                "as", "bn", "brx", "doi", "gu", "hi", "kn", "ks", "kok", "mai",
                "ml", "mni", "mr", "ne", "or", "pa", "sa", "sat", "sd", "ta", "te", "ur"
        };
        for (String lang : scheduled22) {
            assertTrue(TextToSpeechService.SUPPORTED_LANGUAGES.containsKey(lang), "Registry must contain scheduled language: " + lang);
            String status = TextToSpeechService.SUPPORTED_LANGUAGES.get(lang).getStatus();
            assertTrue("production".equals(status) || "preview".equals(status), "Status must be production or preview for " + lang);
        }
        assertTrue(TextToSpeechService.SUPPORTED_LANGUAGES.containsKey("en"), "Registry must contain English");
    }

    @Test
    void testNormalizeAllScheduledLanguages() {
        assertEquals("bn", ttsService.normalizeLanguageCode("bengali"));
        assertEquals("bn", ttsService.normalizeLanguageCode("বাংলা"));
        assertEquals("ta", ttsService.normalizeLanguageCode("tamil"));
        assertEquals("ta", ttsService.normalizeLanguageCode("தமிழ்"));
        assertEquals("te", ttsService.normalizeLanguageCode("telugu"));
        assertEquals("te", ttsService.normalizeLanguageCode("తెలుగు"));
        assertEquals("gu", ttsService.normalizeLanguageCode("gujarati"));
        assertEquals("gu", ttsService.normalizeLanguageCode("ગુજરાતી"));
        assertEquals("kn", ttsService.normalizeLanguageCode("kannada"));
        assertEquals("kn", ttsService.normalizeLanguageCode("ಕನ್ನಡ"));
        assertEquals("ml", ttsService.normalizeLanguageCode("malayalam"));
        assertEquals("ml", ttsService.normalizeLanguageCode("മലയാളം"));
        assertEquals("pa", ttsService.normalizeLanguageCode("punjabi"));
        assertEquals("pa", ttsService.normalizeLanguageCode("ਪੰਜਾਬੀ"));
        assertEquals("ur", ttsService.normalizeLanguageCode("urdu"));
        assertEquals("ur", ttsService.normalizeLanguageCode("اردو"));
        assertEquals("ne", ttsService.normalizeLanguageCode("nepali"));
        assertEquals("ne", ttsService.normalizeLanguageCode("नेपाली"));
        assertEquals("sa", ttsService.normalizeLanguageCode("sanskrit"));
        assertEquals("sa", ttsService.normalizeLanguageCode("संस्कृतम्"));
        assertEquals("as", ttsService.normalizeLanguageCode("assamese"));
        assertEquals("as", ttsService.normalizeLanguageCode("অসমীয়া"));
        assertEquals("or", ttsService.normalizeLanguageCode("odia"));
        assertEquals("or", ttsService.normalizeLanguageCode("ଓଡ଼ିଆ"));
        assertEquals("sat", ttsService.normalizeLanguageCode("santali"));
        assertEquals("ks", ttsService.normalizeLanguageCode("kashmiri"));
    }

    @Test
    void testSplitIntoSpeechChunks() {
        String input = "आर्टिफिशियल इंटेलिजेंस छात्रों के सीखने के तरीके को बेहतर बना रहा है। यह हर छात्र की गति और क्षमता के अनुसार व्यक्तिगत शिक्षा प्रदान करता है। इससे विद्यार्थी किसी भी समय अपने प्रश्नों का समाधान पा सकते हैं।";
        java.util.List<String> chunks = ttsService.splitIntoSpeechChunks(input, 120);

        assertNotNull(chunks);
        assertTrue(chunks.size() >= 2);
        for (String chunk : chunks) {
            assertTrue(chunk.length() <= 160, "Chunk should be within reasonable bounds: " + chunk);
        }
    }

    @Test
    void testCacheKeyIsolation() {
        String key1 = ttsService.computeCacheKey("conv1", "msg1", "hi", "modelA", "Rohit", "Text one");
        String key2 = ttsService.computeCacheKey("conv1", "msg1", "hi", "modelA", "Rohit", "Text two");
        String key3 = ttsService.computeCacheKey("conv1", "msg1", "mr", "modelA", "Rohit", "Text one");
        String key4 = ttsService.computeCacheKey("conv2", "msg1", "hi", "modelA", "Rohit", "Text one");

        assertNotEquals(key1, key2, "Different text must yield different cache key");
        assertNotEquals(key1, key3, "Different language must yield different cache key");
        assertNotEquals(key1, key4, "Different conversationId must yield different cache key");
    }

    @Test
    void testSynthesizeUsesHfIndicParlerWhenAvailable() throws Exception {
        byte[] fakeMp3 = new byte[]{'I', 'D', '3', 4, 0, 0, 0, 0, 0, 10, 1, 2, 3};
        when(mockHfClient.synthesize(anyString(), anyString())).thenReturn(fakeMp3);

        TtsRequest request = new TtsRequest("नमस्ते, आप कैसे हैं?", "hi");
        request.setConversationId("conv-123");
        request.setMessageId("msg-456");

        TextToSpeechService.AudioResult result = ttsService.synthesize(request);
        assertNotNull(result);
        assertEquals(fakeMp3.length, result.getAudioBytes().length);
        assertEquals(HfIndicParlerTtsClient.MODEL_ID, result.getModelId());
        assertEquals(HfIndicParlerTtsClient.PROVIDER_NAME, result.getProvider());
        assertEquals("hi", result.getLanguage());
        assertFalse(result.isCached());

        // Second call should return cached copy
        TextToSpeechService.AudioResult cachedResult = ttsService.synthesize(request);
        assertTrue(cachedResult.isCached());
    }

    @Test
    void testSynthesizeTranslatesEnglishToGujaratiWhenNeeded() throws Exception {
        byte[] fakeMp3 = new byte[]{'I', 'D', '3', 4, 0, 0, 0, 0, 0, 10, 5, 6, 7};
        when(mockHfClient.synthesize(anyString(), anyString())).thenReturn(fakeMp3);
        Mockito.doReturn("કૃત્રિમ બુદ્ધિ ખૂબ રસપ્રદ છે.")
                .when(mockTranslationService).translateForSpeech(anyString(), org.mockito.ArgumentMatchers.eq("gu"));

        TtsRequest request = new TtsRequest("Artificial intelligence is fascinating.", "gu");
        request.setConversationId("conv-trans-1");
        request.setMessageId("msg-trans-1");

        TextToSpeechService.AudioResult result = ttsService.synthesize(request);
        assertNotNull(result);
        assertEquals(fakeMp3.length, result.getAudioBytes().length);
        assertEquals("gu", result.getLanguage());
        assertEquals("કૃત્રિમ બુદ્ધિ ખૂબ રસપ્રદ છે.", result.getSpokenText());
    }

    @Test
    void testSynthesizeThrowsWhenTranslationOutputDoesNotMatchScript() throws Exception {
        // Mock translation returning English instead of Gujarati script
        Mockito.doReturn("Artificial intelligence is fascinating.")
                .when(mockTranslationService).translateForSpeech(anyString(), org.mockito.ArgumentMatchers.eq("gu"));

        TtsRequest request = new TtsRequest("Artificial intelligence is fascinating.", "gu");
        request.setConversationId("conv-trans-2");
        request.setMessageId("msg-trans-2");

        assertThrows(IllegalStateException.class, () -> {
            ttsService.synthesize(request);
        });
    }
}
