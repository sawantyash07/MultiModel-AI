package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.service.provider.GeminiProvider;
import com.coderarmy.ragsupport.service.provider.GroqProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class TranslationServiceTest {

    private TranslationService translationService;
    private GroqProvider mockGroqProvider;
    private GeminiProvider mockGeminiProvider;

    @BeforeEach
    void setUp() {
        mockGroqProvider = Mockito.mock(GroqProvider.class);
        mockGeminiProvider = Mockito.mock(GeminiProvider.class);
        translationService = new TranslationService(mockGroqProvider, mockGeminiProvider);
    }

    @Test
    void testIsMatchingScriptAcrossAllScripts() {
        // Gujarati
        assertTrue(translationService.isMatchingScript("કૃત્રિમ બુદ્ધિ એ કમ્પ્યુટર વિજ્ઞાનની એક શાખા છે.", "gu"));
        assertFalse(translationService.isMatchingScript("This is pure English text.", "gu"));

        // Hindi (Devanagari)
        assertTrue(translationService.isMatchingScript("नमस्ते! कृत्रिम बुद्धिमत्ता एक तकनीक है।", "hi"));
        assertFalse(translationService.isMatchingScript("This is pure English text.", "hi"));

        // Marathi (Devanagari)
        assertTrue(translationService.isMatchingScript("नमस्कार! कृत्रिम बुद्धिमत्ता संगणक शास्त्राची एक शाखा आहे.", "mr"));

        // Bengali
        assertTrue(translationService.isMatchingScript("নমস্কার, কৃত্রিম বুদ্ধিমত্তা আপনাকে সাহায্য করতে পারে।", "bn"));

        // Tamil
        assertTrue(translationService.isMatchingScript("வணக்கம்! செயற்கை நுண்ணறிவு எவ்வாறு செயல்படுகிறது.", "ta"));

        // Telugu
        assertTrue(translationService.isMatchingScript("నమస్కారం! కృత్రిమ మేధస్సు ఎలా పనిచేస్తుంది.", "te"));

        // Kannada
        assertTrue(translationService.isMatchingScript("ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಒಂದು ತಂತ್ರಜ್ಞಾನವಾಗಿದೆ.", "kn"));

        // Malayalam
        assertTrue(translationService.isMatchingScript("കൃത്രിമബുദ്ധി ഒരു സാങ്കേതികവിദ്യയാണ്.", "ml"));

        // Punjabi (Gurmukhi)
        assertTrue(translationService.isMatchingScript("ਨਮਸਤੇ! ਏਆਈ ਕਿਵੇਂ ਕੰਮ ਕਰਦੀ ਹੈ।", "pa"));

        // Odia
        assertTrue(translationService.isMatchingScript("କୃତ୍ରିମ ବୁଦ୍ଧିମତା ଏକ ଆଧୁନିକ ପ୍ରଯୁକ୍ତିବିଦ୍ୟା।", "or"));

        // Urdu (Arabic/Perso-Arabic)
        assertTrue(translationService.isMatchingScript("خوش آمدید، مصنوعی ذہانت کیا ہے۔", "ur"));

        // English
        assertTrue(translationService.isMatchingScript("Hello, this is artificial intelligence.", "en"));
        assertFalse(translationService.isMatchingScript("નમસ્તે આર્ટિફિશિયલ ઇન્ટેલિજન્સ", "en"));
    }

    @Test
    void testPassthroughForSameLanguage() throws Exception {
        String input = "Artificial intelligence enables machines to learn.";
        String result = translationService.translateText(input, "en", "en");
        assertEquals(input, result);
    }

    @Test
    void testPassthroughIfAlreadyInTargetScript() throws Exception {
        String gujaratiText = "કૃત્રિમ બુદ્ધિ કમ્પ્યુટર વિજ્ઞાનની એક શાખા છે.";
        String result = translationService.translateText(gujaratiText, "en", "gu");
        assertEquals(gujaratiText, result);

        String hindiText = "कृत्रिम बुद्धिमत्ता कंप्यूटर विज्ञान की एक शाखा है।";
        String hiResult = translationService.translateText(hindiText, "en", "hi");
        assertEquals(hindiText, hiResult);
    }

    @Test
    void testThrowsWhenNoProviderConfiguredForEnglishToGujarati() {
        when(mockGroqProvider.isConfigured()).thenReturn(false);
        when(mockGeminiProvider.isConfigured()).thenReturn(false);

        String englishText = "Explain artificial intelligence in simple words.";
        assertThrows(IllegalStateException.class, () -> {
            translationService.translateText(englishText, "en", "gu");
        });
    }

    @Test
    void testEmptyAndNullInputs() throws Exception {
        assertEquals("", translationService.translateText("", "en", "gu"));
        assertEquals("", translationService.translateText(null, "en", "gu"));
        assertEquals("", translationService.translateText("   ", "en", "gu"));
    }
}
