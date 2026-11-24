package com.coderarmy.ragsupport.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class IndianTextNormalizerTest {

    private IndianTextNormalizer normalizer;

    @BeforeEach
    void setUp() {
        normalizer = new IndianTextNormalizer();
    }

    @Test
    void testCurrencyExpansion() {
        // Hindi currency expansion
        String hindiNorm = normalizer.normalizeForSpeech("यह कोर्स ₹500 का है।", "hi");
        assertTrue(hindiNorm.contains("500 रुपये"), "Should expand ₹ to रुपये in Hindi: " + hindiNorm);

        // Marathi currency expansion
        String marathiNorm = normalizer.normalizeForSpeech("हा कोर्स ₹1200 चा आहे.", "mr");
        assertTrue(marathiNorm.contains("1200 रुपये"), "Should expand ₹ to रुपये in Marathi: " + marathiNorm);

        // English currency expansion
        String englishNorm = normalizer.normalizeForSpeech("The price is ₹750 or $10.", "en");
        assertTrue(englishNorm.contains("750 rupees") && englishNorm.contains("10 dollars"),
                "Should expand ₹ to rupees and $ to dollars in English: " + englishNorm);

        // Tamil currency expansion
        String tamilNorm = normalizer.normalizeForSpeech("விலை ₹2000.", "ta");
        assertTrue(tamilNorm.contains("2000 ரூபாய்"), "Should expand ₹ to ரூபாய் in Tamil: " + tamilNorm);
    }

    @Test
    void testPercentageExpansion() {
        // Hindi percentage
        String hindiPct = normalizer.normalizeForSpeech("सटीकता 95.5% है।", "hi");
        assertTrue(hindiPct.contains("95.5 प्रतिशत"), "Should expand % to प्रतिशत in Hindi: " + hindiPct);

        // Marathi percentage
        String marathiPct = normalizer.normalizeForSpeech("सूट 20% आहे.", "mr");
        assertTrue(marathiPct.contains("20 टक्के"), "Should expand % to टक्के in Marathi: " + marathiPct);

        // English percentage
        String enPct = normalizer.normalizeForSpeech("Growth is 15%.", "en");
        assertTrue(enPct.contains("15 percent"), "Should expand % to percent in English: " + enPct);
    }

    @Test
    void testAcronymExpansionInDevanagari() {
        String input = "Yash AI में नया REST API और modern UI तैयार है।";
        String normalized = normalizer.normalizeForSpeech(input, "hi");
        assertTrue(normalized.contains("एआई"), "AI should be expanded to एआई: " + normalized);
        assertTrue(normalized.contains("एपीआई"), "API should be expanded to एपीआई: " + normalized);
        assertTrue(normalized.contains("यूआई"), "UI should be expanded to यूआई: " + normalized);
    }

    @Test
    void testMarkdownAndCodeBlockStripping() {
        String md = "Here is the code:\n```python\ndef hello():\n    print('Hello World')\n```\nIt works great with **bold** text, [Yash AI Docs](https://docs.yash.ai), and direct link https://yash.ai.";
        String normalized = normalizer.normalizeForSpeech(md, "en");

        assertFalse(normalized.contains("def hello"), "Code block content should be stripped for speech: " + normalized);
        assertFalse(normalized.contains("```"), "Code fences should be stripped: " + normalized);
        assertFalse(normalized.contains("**"), "Markdown bold markers should be stripped: " + normalized);
        assertTrue(normalized.contains("bold text"), "Text inside bold markers should be preserved: " + normalized);
        assertTrue(normalized.contains("Yash AI Docs"), "Link anchor text should be preserved: " + normalized);
        assertTrue(normalized.contains("website yash.ai"), "Standalone URL should be converted to website reference: " + normalized);
    }

    @Test
    void testSpeechChunking() {
        String longText = "यह पहली पंक्ति है। यह दूसरी पंक्ति है! और यह तीसरी पंक्ति है? चौथी पंक्ति भी शामिल है।";
        List<String> chunks = normalizer.splitIntoSpeechChunks(longText, 45);

        assertNotNull(chunks);
        assertTrue(chunks.size() >= 2, "Long text should be segmented into multiple speech chunks: " + chunks.size());
        for (String chunk : chunks) {
            assertFalse(chunk.isBlank(), "Chunk should not be blank");
        }
    }
}
