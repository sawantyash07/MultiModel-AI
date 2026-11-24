package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.LanguageRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Language-Aware Text Normalizer for Indian Languages and English.
 *
 * Implements pre-synthesis text preparation for high-accuracy neural TTS:
 * 1. Unicode canonical normalization (NFC) and combining-mark reconciliation.
 * 2. Markdown, HTML, URLs, and code block stripping without altering display text.
 * 3. Currency symbol expansion (₹ -> रुपये / rupees / ரூபாய் / etc.).
 * 4. Percentage expansion (% -> प्रतिशत / टक्के / percent / etc.).
 * 5. Numbers, measurement units, and date/time formatting.
 * 6. Common technical acronyms (AI, API, UI, URL, HTTP, JSON, CPU, OTP, UPI, GST, PDF).
 * 7. Punctuation sanitization and natural sentence chunking.
 */
@Component
public class IndianTextNormalizer {

    private static final Logger log = LoggerFactory.getLogger(IndianTextNormalizer.class);

    // Common acronym phonetics mapped to Devanagari (used for Hindi, Marathi, Nepali, Sanskrit, Maithili, Konkani, etc.)
    private static final Map<String, String> DEVANAGARI_ACRONYMS = new LinkedHashMap<>();
    static {
        DEVANAGARI_ACRONYMS.put("AI", "एआई");
        DEVANAGARI_ACRONYMS.put("API", "एपीआई");
        DEVANAGARI_ACRONYMS.put("UI", "यूआई");
        DEVANAGARI_ACRONYMS.put("UX", "यूएक्स");
        DEVANAGARI_ACRONYMS.put("URL", "यूआरएल");
        DEVANAGARI_ACRONYMS.put("URI", "यूआरआई");
        DEVANAGARI_ACRONYMS.put("HTTP", "एचटीटीपी");
        DEVANAGARI_ACRONYMS.put("HTTPS", "एचटीटीपीएस");
        DEVANAGARI_ACRONYMS.put("HTML", "एचटीएमएल");
        DEVANAGARI_ACRONYMS.put("CSS", "सीएसएस");
        DEVANAGARI_ACRONYMS.put("JSON", "जेसॉन");
        DEVANAGARI_ACRONYMS.put("CPU", "सीपीयू");
        DEVANAGARI_ACRONYMS.put("GPU", "जीपीयू");
        DEVANAGARI_ACRONYMS.put("RAM", "रैम");
        DEVANAGARI_ACRONYMS.put("ROM", "रोम");
        DEVANAGARI_ACRONYMS.put("OTP", "ओटीपी");
        DEVANAGARI_ACRONYMS.put("UPI", "यूपीआई");
        DEVANAGARI_ACRONYMS.put("GST", "जीएसटी");
        DEVANAGARI_ACRONYMS.put("PDF", "पीडीएफ");
        DEVANAGARI_ACRONYMS.put("IT", "आईटी");
        DEVANAGARI_ACRONYMS.put("ID", "आईडी");
        DEVANAGARI_ACRONYMS.put("SQL", "एसक्यूएल");
        DEVANAGARI_ACRONYMS.put("LLM", "एलएलएम");
        DEVANAGARI_ACRONYMS.put("TTS", "टीटीएस");
        DEVANAGARI_ACRONYMS.put("ASR", "एएसआर");
        DEVANAGARI_ACRONYMS.put("SDK", "एसडीके");
        DEVANAGARI_ACRONYMS.put("FAQ", "एफएक्यू");
        DEVANAGARI_ACRONYMS.put("PIN", "पिन");
        DEVANAGARI_ACRONYMS.put("PAN", "पैन");
        DEVANAGARI_ACRONYMS.put("ATM", "एटीएम");
        DEVANAGARI_ACRONYMS.put("SMS", "एसएमएस");
        DEVANAGARI_ACRONYMS.put("QR", "क्यूआर");
        DEVANAGARI_ACRONYMS.put("WiFi", "वाईफाई");
        DEVANAGARI_ACRONYMS.put("Wifi", "वाईफाई");
        DEVANAGARI_ACRONYMS.put("Wi-Fi", "वाईफाई");
    }

    /**
     * Primary entry point: Prepares raw message text into language-accurate,
     * phonetically clean spoken text for the specified language.
     *
     * @param rawText Original LLM or user text.
     * @param languageCode Canonical language code (e.g. "hi", "mr", "en", "gu", "ta").
     * @return Clean, speakable text in native script or English.
     */
    public String normalizeForSpeech(String rawText, String languageCode) {
        if (rawText == null || rawText.isBlank()) return "";

        String lang = LanguageRegistry.normalizeCode(languageCode);

        // 1. Strip Markdown, HTML, Code blocks, and Tables into readable prose
        String text = cleanMarkdownAndStructuralElements(rawText, lang);

        // 2. Unicode Canonical Normalization (NFC)
        text = Normalizer.normalize(text, Normalizer.Form.NFC);

        // 3. Remove non-printable control characters while preserving Indic marks
        text = cleanControlCharacters(text);

        // 4. Expand Currency symbols
        text = expandCurrency(text, lang);

        // 5. Expand Percentages
        text = expandPercentages(text, lang);

        // 6. Expand Units & Measurements
        text = expandUnits(text, lang);

        // 7. Expand Common Abbreviations & Acronyms
        text = expandAcronyms(text, lang);

        // 8. Normalize Punctuation and Sentence Breaks
        text = normalizePunctuation(text, lang);

        return text.trim();
    }

    /**
     * Cleans Markdown syntax, fenced code blocks, tables, links, and HTML tags.
     */
    public String cleanMarkdownAndStructuralElements(String md, String lang) {
        if (md == null) return "";
        String text = md;

        // 1. Code blocks ```lang ... ``` -> announce as brief transition or skip
        text = text.replaceAll("(?s)```[\\w-]*\\s*\\n?[\\s\\S]*?```", " ");

        // 2. Inline code `code` -> code
        text = text.replaceAll("`([^`]+)`", "$1");

        // 3. Markdown images ![alt](url) -> alt
        text = text.replaceAll("!\\[([^\\]]*)\\]\\([^)]+\\)", "$1");

        // 4. Markdown links [text](url) -> text
        text = text.replaceAll("\\[([^\\]]+)\\]\\([^)]+\\)", "$1");

        // 5. URLs https://example.com/path -> spoken website name
        text = replaceUrlsForSpeech(text, lang);

        // 6. Markdown headers (#, ##, ###)
        text = text.replaceAll("(?m)^#{1,6}\\s*", "");

        // 7. Bold / Italics / Strikethrough
        text = text.replaceAll("\\*\\*([^*]+)\\*\\*", "$1");
        text = text.replaceAll("\\*([^*]+)\\*", "$1");
        text = text.replaceAll("__([^_]+)__", "$1");
        text = text.replaceAll("_([^_]+)_", "$1");
        text = text.replaceAll("~~([^~]+)~~", "$1");

        // 8. Markdown Table lines (| col | col |)
        text = cleanMarkdownTables(text);

        // 9. Blockquotes >
        text = text.replaceAll("(?m)^>\\s*", "");

        // 10. List markers (*, -, +, 1.)
        text = text.replaceAll("(?m)^\\s*[-*+]\\s+", "");
        text = text.replaceAll("(?m)^\\s*\\d+\\.\\s+", "");

        // 11. Horizontal rules (---, ***, ___)
        text = text.replaceAll("(?m)^[-*_]{3,}\\s*$", "");

        // 12. HTML tags <...>
        text = text.replaceAll("<[^>]+>", " ");

        return text;
    }

    private String replaceUrlsForSpeech(String text, String lang) {
        Pattern urlPattern = Pattern.compile("https?://(?:www\\.)?([a-zA-Z0-9.-]+)(?:/[^\\s]*)?");
        Matcher matcher = urlPattern.matcher(text);
        StringBuffer sb = new StringBuffer();
        String websiteWord = "en".equals(lang) ? "website" : "वेबसाइट";
        while (matcher.find()) {
            String domain = matcher.group(1);
            matcher.appendReplacement(sb, websiteWord + " " + Matcher.quoteReplacement(domain));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private String cleanMarkdownTables(String text) {
        String[] lines = text.split("\\r?\\n");
        StringBuilder sb = new StringBuilder();
        for (String line : lines) {
            String trimmed = line.trim();
            // Skip markdown table separator lines like |---|---|
            if (trimmed.matches("^\\|?\\s*[-:]+[-| :]*\\|?$")) {
                continue;
            }
            if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
                String row = trimmed.replaceAll("^\\|", "").replaceAll("\\|$", "");
                String[] cells = row.split("\\|");
                List<String> cleanCells = new ArrayList<>();
                for (String c : cells) {
                    String ct = c.trim();
                    if (!ct.isEmpty()) cleanCells.add(ct);
                }
                sb.append(String.join(", ", cleanCells)).append(". ");
            } else {
                sb.append(line).append("\n");
            }
        }
        return sb.toString();
    }

    private String cleanControlCharacters(String text) {
        // Strip non-printable ASCII/control codes, preserving tabs, newlines, and Indic Unicode blocks
        return text.replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]", "");
    }

    /**
     * Expands currency symbols into language-appropriate spoken words.
     * e.g. ₹500 -> 500 रुपये (Devanagari) / 500 rupees (English) / 500 ரூபாய் (Tamil)
     */
    private String expandCurrency(String text, String lang) {
        String inrWord;
        String usdWord;
        String eurWord;

        switch (lang) {
            case "mr":
                inrWord = "रुपये";
                usdWord = "अमेरिकन डॉलर";
                eurWord = "युरो";
                break;
            case "bn":
            case "as":
                inrWord = "টাকা";
                usdWord = "ডলার";
                eurWord = "ইউরো";
                break;
            case "gu":
                inrWord = "રૂપિયા";
                usdWord = "ડૉલર";
                eurWord = "યૂરો";
                break;
            case "ta":
                inrWord = "ரூபாய்";
                usdWord = "டாலர்";
                eurWord = "யூரோ";
                break;
            case "te":
                inrWord = "రూపాయలు";
                usdWord = "డాలర్లు";
                eurWord = "యూరోలు";
                break;
            case "kn":
                inrWord = "ರೂಪಾಯಿ";
                usdWord = "ಡಾಲರ್";
                eurWord = "ಯುರೋ";
                break;
            case "ml":
                inrWord = "രൂപ";
                usdWord = "ഡോളർ";
                eurWord = "യൂറോ";
                break;
            case "pa":
                inrWord = "ਰੁਪਏ";
                usdWord = "ਡਾਲਰ";
                eurWord = "ਯੂਰੋ";
                break;
            case "ur":
                inrWord = "روپے";
                usdWord = "ڈالر";
                eurWord = "یورو";
                break;
            case "en":
                inrWord = "rupees";
                usdWord = "dollars";
                eurWord = "euros";
                break;
            case "hi":
            default:
                inrWord = "रुपये";
                usdWord = "डॉलर";
                eurWord = "यूरो";
                break;
        }

        // ₹500 or ₹ 500 or Rs. 500 or Rs 500 -> 500 रुपये
        text = text.replaceAll("(?:₹|Rs\\.?|INR)\\s*([0-9,]+(?:\\.[0-9]+)?)", "$1 " + inrWord);
        // $50 or $ 50 -> 50 डॉलर
        text = text.replaceAll("\\$\\s*([0-9,]+(?:\\.[0-9]+)?)", "$1 " + usdWord);
        // €50 or € 50 -> 50 यूरो
        text = text.replaceAll("€\\s*([0-9,]+(?:\\.[0-9]+)?)", "$1 " + eurWord);

        return text;
    }

    /**
     * Expands percentage symbols into spoken words.
     * e.g. 50% -> 50 प्रतिशत (Hindi) / 50 टक्के (Marathi) / 50 percent (English)
     */
    private String expandPercentages(String text, String lang) {
        String pctWord;
        switch (lang) {
            case "mr":
                pctWord = "टक्के";
                break;
            case "bn":
            case "as":
                pctWord = "শতাংশ";
                break;
            case "gu":
                pctWord = "ટકા";
                break;
            case "ta":
                pctWord = "சதவீதம்";
                break;
            case "te":
                pctWord = "శాతం";
                break;
            case "kn":
                pctWord = "ಪ್ರತಿಶತ";
                break;
            case "ml":
                pctWord = "ശതമാനം";
                break;
            case "pa":
                pctWord = "ਫੀਸਦੀ";
                break;
            case "ur":
                pctWord = "فیصد";
                break;
            case "en":
                pctWord = "percent";
                break;
            case "hi":
            default:
                pctWord = "प्रतिशत";
                break;
        }

        // 50% or 50.5% -> 50 प्रतिशत
        return text.replaceAll("([0-9]+(?:\\.[0-9]+)?)\\s*%", "$1 " + pctWord);
    }

    /**
     * Expands common measurement units.
     */
    private String expandUnits(String text, String lang) {
        if ("en".equals(lang)) {
            text = text.replaceAll("(?i)\\b([0-9]+)\\s*km\\b", "$1 kilometers");
            text = text.replaceAll("(?i)\\b([0-9]+)\\s*kg\\b", "$1 kilograms");
            text = text.replaceAll("(?i)\\b([0-9]+)\\s*m\\b", "$1 meters");
            text = text.replaceAll("(?i)\\b([0-9]+)\\s*cm\\b", "$1 centimeters");
            text = text.replaceAll("(?i)\\b([0-9]+)\\s*gb\\b", "$1 gigabytes");
            text = text.replaceAll("(?i)\\b([0-9]+)\\s*mb\\b", "$1 megabytes");
            text = text.replaceAll("(?i)\\b([0-9]+)\\s*hrs?\\b", "$1 hours");
            text = text.replaceAll("(?i)\\b([0-9]+)\\s*sec\\b", "$1 seconds");
            text = text.replaceAll("(?i)\\b([0-9]+)\\s*min\\b", "$1 minutes");
            return text;
        }

        String kmWord = "mr".equals(lang) ? "किलोमीटर" : "किलोमीटर";
        String kgWord = "mr".equals(lang) ? "किलोग्रॅम" : "किलोग्राम";
        String mWord = "मीटर";
        String hrWord = "mr".equals(lang) ? "तास" : "घंटे";
        String secWord = "सेकंड";

        text = text.replaceAll("(?i)\\b([0-9]+)\\s*km\\b", "$1 " + kmWord);
        text = text.replaceAll("(?i)\\b([0-9]+)\\s*kg\\b", "$1 " + kgWord);
        text = text.replaceAll("(?i)\\b([0-9]+)\\s*m\\b", "$1 " + mWord);
        text = text.replaceAll("(?i)\\b([0-9]+)\\s*hrs?\\b", "$1 " + hrWord);
        text = text.replaceAll("(?i)\\b([0-9]+)\\s*sec\\b", "$1 " + secWord);
        text = text.replaceAll("(?i)\\b([0-9]+)\\s*gb\\b", "$1 जीबी");
        text = text.replaceAll("(?i)\\b([0-9]+)\\s*mb\\b", "$1 एमबी");

        return text;
    }

    /**
     * Expands technical acronyms and common abbreviations into natural phonetics.
     */
    private String expandAcronyms(String text, String lang) {
        // In English, acronyms like API, AI, URL are read fine by neural TTS
        if ("en".equals(lang)) {
            text = text.replaceAll("(?i)\\be\\.g\\.,?\\b", "for example,");
            text = text.replaceAll("(?i)\\bi\\.e\\.,?\\b", "that is,");
            text = text.replaceAll("(?i)\\betc\\.?\\b", "etcetera");
            return text;
        }

        // For Devanagari languages (Hindi, Marathi, Nepali, Sanskrit, Maithili, Konkani, etc.)
        boolean isDevanagariTarget = List.of("hi", "mr", "ne", "sa", "mai", "kok", "brx", "doi").contains(lang);
        if (isDevanagariTarget) {
            for (Map.Entry<String, String> entry : DEVANAGARI_ACRONYMS.entrySet()) {
                String acronym = entry.getKey();
                String phonetic = entry.getValue();
                // Match word boundary for acronym
                text = text.replaceAll("\\b" + Pattern.quote(acronym) + "\\b", phonetic);
            }

            text = text.replaceAll("(?i)\\be\\.g\\.,?\\b", "mr".equals(lang) ? "उदाहरणार्थ," : "उदाहरण के लिए,");
            text = text.replaceAll("(?i)\\bi\\.e\\.,?\\b", "अर्थात,");
            text = text.replaceAll("(?i)\\betc\\.?\\b", "mr".equals(lang) ? "इत्यादी" : "इत्यादि");
        }

        return text;
    }

    /**
     * Sanitizes punctuation marks, quotes, and sentence boundaries.
     */
    private String normalizePunctuation(String text, String lang) {
        // 1. Collapse multiple newlines & whitespace into single spaces
        text = text.replaceAll("[ \\t]+", " ");
        text = text.replaceAll("\\n{2,}", ". ");
        text = text.replaceAll("\\n", " ");

        // 2. Collapse repeated dots (...) to single dot
        text = text.replaceAll("\\.{2,}", ".");

        // 3. Normalize quotes to simple quotes
        text = text.replaceAll("[“”„‟«»]", "\"");
        text = text.replaceAll("[‘’‚‛]", "'");

        // 4. Normalize dashes/hyphens surrounded by spaces into commas for natural pause
        text = text.replaceAll("\\s+[—–-]\\s+", ", ");

        // 5. Ensure space after sentence-ending punctuation if missing
        text = text.replaceAll("([!?,।])([a-zA-Z\\u0900-\\u0D7F])", "$1 $2");
        text = text.replaceAll("\\.([A-Z\\u0900-\\u0D7F])", ". $1");

        return text.trim();
    }

    /**
     * Splits prepared text into safe, context-aware speech chunks.
     * Uses natural sentence boundaries (., !, ?, ।, \n) and limits chunk size.
     */
    public List<String> splitIntoSpeechChunks(String text, int maxChunkLength) {
        if (text == null || text.isBlank()) return Collections.emptyList();

        List<String> result = new ArrayList<>();
        // Split along sentence terminators
        Pattern pattern = Pattern.compile("([^\\n.!?।]+[.\\n!?।]*)(?:\\s+|$)");
        Matcher matcher = pattern.matcher(text);
        List<String> sentences = new ArrayList<>();
        int lastEnd = 0;
        while (matcher.find()) {
            String s = matcher.group(1).trim();
            if (!s.isEmpty()) sentences.add(s);
            lastEnd = matcher.end();
        }
        if (lastEnd < text.length()) {
            String remainder = text.substring(lastEnd).trim();
            if (!remainder.isEmpty()) sentences.add(remainder);
        }
        if (sentences.isEmpty()) {
            sentences.add(text.trim());
        }

        StringBuilder currentChunk = new StringBuilder();
        for (String sentence : sentences) {
            if (currentChunk.length() == 0) {
                if (sentence.length() > maxChunkLength) {
                    splitLongSentence(sentence, maxChunkLength, result);
                } else {
                    currentChunk.append(sentence);
                }
            } else if (currentChunk.length() + 1 + sentence.length() <= maxChunkLength) {
                currentChunk.append(" ").append(sentence);
            } else {
                result.add(currentChunk.toString().trim());
                currentChunk.setLength(0);
                if (sentence.length() > maxChunkLength) {
                    splitLongSentence(sentence, maxChunkLength, result);
                } else {
                    currentChunk.append(sentence);
                }
            }
        }
        if (currentChunk.length() > 0) {
            result.add(currentChunk.toString().trim());
        }
        return result;
    }

    private void splitLongSentence(String sentence, int maxLen, List<String> result) {
        String remaining = sentence.trim();
        while (remaining.length() > maxLen) {
            int splitIdx = remaining.lastIndexOf(' ', maxLen);
            if (splitIdx <= 0) {
                splitIdx = remaining.lastIndexOf(',', maxLen);
            }
            if (splitIdx <= 0) {
                splitIdx = maxLen;
            }
            result.add(remaining.substring(0, splitIdx).trim());
            remaining = remaining.substring(splitIdx).trim();
        }
        if (!remaining.isEmpty()) {
            result.add(remaining);
        }
    }
}
