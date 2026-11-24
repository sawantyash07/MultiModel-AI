package com.coderarmy.ragsupport.model;

import java.util.*;

/**
 * Central Language Registry for all 22 Scheduled Languages of the Eighth Schedule
 * of the Indian Constitution + English (23 languages total).
 *
 * Defines canonical identifier, English display name, native script label,
 * primary script family, NLLB-200 code, verified TTS models, native voice options,
 * support status ("production" vs "preview"), streaming capabilities, and verified fallbacks.
 */
public final class LanguageRegistry {

    private LanguageRegistry() {}

    public static final class LanguageEntry {
        private final String code;
        private final String name;
        private final String nativeName;
        private final String script;
        private final String nllbCode;
        private final String ttsModelId;
        private final String ttsProvider;
        private final String defaultSpeaker;
        private final String status; // "production" | "preview" | "experimental" | "unavailable"
        private final String description;
        private final boolean nativeLlmSupported;
        private final boolean streamingSupported;
        private final String fallbackProvider;
        private final int maxCharacters;
        private final List<String> availableProviders;
        private final List<TtsLanguageInfo.VoiceOption> voices;

        public LanguageEntry(String code, String name, String nativeName, String script,
                             String nllbCode, String ttsModelId, String ttsProvider,
                             String defaultSpeaker, String status, String description,
                             boolean nativeLlmSupported, boolean streamingSupported,
                             String fallbackProvider, int maxCharacters,
                             List<String> availableProviders,
                             List<TtsLanguageInfo.VoiceOption> voices) {
            this.code = code;
            this.name = name;
            this.nativeName = nativeName;
            this.script = script;
            this.nllbCode = nllbCode;
            this.ttsModelId = ttsModelId;
            this.ttsProvider = ttsProvider;
            this.defaultSpeaker = defaultSpeaker;
            this.status = status;
            this.description = description;
            this.nativeLlmSupported = nativeLlmSupported;
            this.streamingSupported = streamingSupported;
            this.fallbackProvider = fallbackProvider;
            this.maxCharacters = maxCharacters;
            this.availableProviders = availableProviders != null ? availableProviders : Collections.emptyList();
            this.voices = voices != null ? voices : Collections.emptyList();
        }

        public String getCode() { return code; }
        public String getName() { return name; }
        public String getNativeName() { return nativeName; }
        public String getScript() { return script; }
        public String getNllbCode() { return nllbCode; }
        public String getTtsModelId() { return ttsModelId; }
        public String getTtsProvider() { return ttsProvider; }
        public String getDefaultSpeaker() { return defaultSpeaker; }
        public String getStatus() { return status; }
        public String getDescription() { return description; }
        public boolean isNativeLlmSupported() { return nativeLlmSupported; }
        public boolean isStreamingSupported() { return streamingSupported; }
        public String getFallbackProvider() { return fallbackProvider; }
        public int getMaxCharacters() { return maxCharacters; }
        public List<String> getAvailableProviders() { return availableProviders; }
        public List<TtsLanguageInfo.VoiceOption> getVoices() { return voices; }

        public TtsLanguageInfo toTtsLanguageInfo() {
            TtsLanguageInfo info = new TtsLanguageInfo(code, name, nativeName, defaultSpeaker, description);
            info.setScript(script);
            info.setStatus(status);
            info.setModelId(ttsModelId);
            info.setProvider(ttsProvider);
            info.setNativeLlmSupported(nativeLlmSupported);
            info.setStreamingSupported(streamingSupported);
            info.setFallbackProvider(fallbackProvider);
            info.setMaxCharacters(maxCharacters);
            info.setAvailableProviders(new ArrayList<>(availableProviders));
            info.setVoices(new ArrayList<>(voices));
            return info;
        }
    }

    private static final String PROVIDER_SARVAM = "Sarvam AI Bulbul (v4-flash / v3)";
    private static final String PROVIDER_GOOGLE = "Google Hosted Multilingual Speech Engine";
    private static final String PROVIDER_BODHAN = "Bodhan Indic Speech Engine (api.bodhan.ai)";

    private static final String MODEL_SARVAM_V4 = "sarvam/bulbul:v4-flash";
    private static final String MODEL_GOOGLE = "google/multilingual-tts";
    private static final String MODEL_BODHAN = "bodhan-ai/indic-speak";

    private static final List<LanguageEntry> ALL_LANGUAGES = List.of(
            // English (Standard reference & Indian English)
            new LanguageEntry("en", "English", "English", "Latin", "eng_Latn",
                    MODEL_SARVAM_V4, PROVIDER_SARVAM, "shubh", "production",
                    "Clear English voice with articulate phrasing and balanced cadence.",
                    true, true, PROVIDER_GOOGLE, 2500,
                    List.of("sarvam", "google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("shubh", "Shubh", "Male", "Confident Indian English", true, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("aditya", "Aditya", "Male", "Modern & Crisp", false, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("amelia", "Amelia", "Female", "Clear Global English", false, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("natural", "Natural", "Female", "Neutral & Balanced", false, "google-hosted")
                    )),

            // 1. Assamese — অসমীয়া (Preview Tier - requires Bodhan/Bhashini dedicated endpoint)
            new LanguageEntry("as", "Assamese", "অসমীয়া", "Bengali-Assamese", "asm_Beng",
                    MODEL_BODHAN, PROVIDER_BODHAN, "aditi", "preview",
                    "Assamese eastern Indic phonetics. Native LLM text generation is supported; voice synthesis requires Bodhan or Bhashini enterprise credentials.",
                    true, false, "None", 2500,
                    List.of("bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("aditi", "Aditi", "Female", "Authentic Eastern Diction", true, "bodhan"),
                            new TtsLanguageInfo.VoiceOption("amit", "Amit", "Male", "Narrative", false, "bodhan")
                    )),

            // 2. Bengali — বাংলা (Production)
            new LanguageEntry("bn", "Bengali", "বাংলা", "Bengali", "ben_Beng",
                    MODEL_SARVAM_V4, PROVIDER_SARVAM, "aditi", "production",
                    "Melodious Bengali voice with accurate vowel harmony, natural rhythm, and high-clarity speech.",
                    true, true, PROVIDER_GOOGLE, 2500,
                    List.of("sarvam", "google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("aditi", "Aditi", "Female", "Melodious & Clear", true, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("shubh", "Shubh", "Male", "Confident & Bold", false, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("ritu", "Ritu", "Female", "Calm & Natural", false, "sarvam")
                    )),

            // 3. Bodo — बड़ो (Preview Tier)
            new LanguageEntry("brx", "Bodo", "बड़ो", "Devanagari", "brx_Deva",
                    MODEL_BODHAN, PROVIDER_BODHAN, "rohit", "preview",
                    "Bodo language voice. Native LLM generation in Devanagari is supported; voice synthesis requires Bodhan or Bhashini credentials.",
                    true, false, "None", 2500,
                    List.of("bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("rohit", "Rohit", "Male", "Devanagari Phonology", true, "bodhan")
                    )),

            // 4. Dogri — डोगरी (Preview Tier)
            new LanguageEntry("doi", "Dogri", "डोगरी", "Devanagari", "doi_Deva",
                    MODEL_BODHAN, PROVIDER_BODHAN, "rohit", "preview",
                    "Dogri northern voice. Native LLM text generation supported; voice synthesis requires Bodhan enterprise credentials.",
                    true, false, "None", 2500,
                    List.of("bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("rohit", "Rohit", "Male", "Northern Tonal Diction", true, "bodhan")
                    )),

            // 5. Gujarati — ગુજરાતી (Production)
            new LanguageEntry("gu", "Gujarati", "ગુજરાતી", "Gujarati", "guj_Gujr",
                    MODEL_SARVAM_V4, PROVIDER_SARVAM, "shubh", "production",
                    "Expressive Gujarati voice with authentic regional articulation and natural cadence.",
                    true, true, PROVIDER_GOOGLE, 2500,
                    List.of("sarvam", "google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("shubh", "Shubh", "Male", "Confident & Fluent", true, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("jaya", "Jaya", "Female", "Expressive & Clear", false, "google-hosted"),
                            new TtsLanguageInfo.VoiceOption("ritu", "Ritu", "Female", "Calm & Natural", false, "sarvam")
                    )),

            // 6. Hindi — हिन्दी (Production)
            new LanguageEntry("hi", "Hindi", "हिन्दी", "Devanagari", "hin_Deva",
                    MODEL_SARVAM_V4, PROVIDER_SARVAM, "shubh", "production",
                    "Natural Hindi voice with accurate Devanagari pronunciation, authentic numbers, and code-mixing support.",
                    true, true, PROVIDER_GOOGLE, 2500,
                    List.of("sarvam", "google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("shubh", "Shubh", "Male", "Confident & Bold", true, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("ritu", "Ritu", "Female", "Calm & Natural", false, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("aditya", "Aditya", "Male", "Modern & Crisp", false, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("priya", "Priya", "Female", "Clear & Articulate", false, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("rohit", "Rohit", "Male", "Narrative", false, "google-hosted"),
                            new TtsLanguageInfo.VoiceOption("sunita", "Sunita", "Female", "Calm Narration", false, "google-hosted")
                    )),

            // 7. Kannada — ಕನ್ನಡ (Production)
            new LanguageEntry("kn", "Kannada", "ಕನ್ನಡ", "Kannada", "kan_Knda",
                    MODEL_SARVAM_V4, PROVIDER_SARVAM, "shubh", "production",
                    "Fluid Kannada voice with classical southern phonology and high acoustic clarity.",
                    true, true, PROVIDER_GOOGLE, 2500,
                    List.of("sarvam", "google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("shubh", "Shubh", "Male", "Confident Southern Diction", true, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("suresh", "Suresh", "Male", "Calm Classical Narration", false, "google-hosted"),
                            new TtsLanguageInfo.VoiceOption("ritu", "Ritu", "Female", "Clear & Expressive", false, "sarvam")
                    )),

            // 8. Kashmiri — کٲشُر / कॉशुर (Preview Tier)
            new LanguageEntry("ks", "Kashmiri", "کٲشُر / कॉशुर", "Perso-Arabic / Devanagari", "kas_Arab",
                    MODEL_BODHAN, PROVIDER_BODHAN, "rohit", "preview",
                    "Kashmiri voice. Native LLM text generation is supported; voice synthesis requires Bodhan enterprise credentials.",
                    true, false, "None", 2500,
                    List.of("bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("rohit", "Rohit", "Male", "Perso-Arabic Diction", true, "bodhan")
                    )),

            // 9. Konkani — कोंकणी (Preview Tier)
            new LanguageEntry("kok", "Konkani", "कोंकणी", "Devanagari", "gom_Deva",
                    MODEL_BODHAN, PROVIDER_BODHAN, "sunita", "preview",
                    "Coastal Konkani voice. Native LLM generation in Devanagari supported; voice output requires Bodhan enterprise credentials.",
                    true, false, "None", 2500,
                    List.of("bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("sunita", "Sunita", "Female", "Coastal Konkan Cadence", true, "bodhan")
                    )),

            // 10. Maithili — मैथिली (Preview Tier)
            new LanguageEntry("mai", "Maithili", "मैथिली", "Devanagari", "mai_Deva",
                    MODEL_BODHAN, PROVIDER_BODHAN, "rohit", "preview",
                    "Maithili voice. Native LLM generation supported; voice synthesis requires Bodhan enterprise credentials.",
                    true, false, "None", 2500,
                    List.of("bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("rohit", "Rohit", "Male", "Mithila Linguistic Features", true, "bodhan")
                    )),

            // 11. Malayalam — മലയാളം (Production)
            new LanguageEntry("ml", "Malayalam", "മലയാളം", "Malayalam", "mal_Mlym",
                    MODEL_SARVAM_V4, PROVIDER_SARVAM, "shubh", "production",
                    "Precise Malayalam voice with natural retroflex consonants, fluid rhythm, and clear pace.",
                    true, true, PROVIDER_GOOGLE, 2500,
                    List.of("sarvam", "google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("shubh", "Shubh", "Male", "Precise & Articulate", true, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("anjali", "Anjali", "Female", "Animated & Crisp", false, "google-hosted"),
                            new TtsLanguageInfo.VoiceOption("priya", "Priya", "Female", "Calm Delivery", false, "sarvam")
                    )),

            // 12. Manipuri (Meitei) — মৈতৈলোন্ / মেইতেইলোন্ (Preview Tier)
            new LanguageEntry("mni", "Manipuri (Meitei)", "মৈতৈলোন্ / মেইতেইলোন্", "Meitei Mayek / Bengali", "mni_Beng",
                    MODEL_BODHAN, PROVIDER_BODHAN, "aditi", "preview",
                    "Manipuri (Meitei) voice. Native LLM text generation supported; voice output requires Bodhan enterprise credentials.",
                    true, false, "None", 2500,
                    List.of("bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("aditi", "Aditi", "Female", "Authentic Meitei Diction", true, "bodhan")
                    )),

            // 13. Marathi — मराठी (Production)
            new LanguageEntry("mr", "Marathi", "मराठी", "Devanagari", "mar_Deva",
                    MODEL_SARVAM_V4, PROVIDER_SARVAM, "sunita", "production",
                    "Authentic Marathi voice with rich regional vocabulary, balanced cadence, and precise Devanagari pronunciation.",
                    true, true, PROVIDER_GOOGLE, 2500,
                    List.of("sarvam", "google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("sunita", "Sunita", "Female", "Authentic Marathi Narration", true, "google-hosted"),
                            new TtsLanguageInfo.VoiceOption("shubh", "Shubh", "Male", "Confident & Articulate", false, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("ritu", "Ritu", "Female", "Calm & Natural", false, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("rohit", "Rohit", "Male", "Narrative Tone", false, "google-hosted")
                    )),

            // 14. Nepali — नेपाली (Production via Google Hosted)
            new LanguageEntry("ne", "Nepali", "नेपाली", "Devanagari", "npi_Deva",
                    MODEL_GOOGLE, PROVIDER_GOOGLE, "sunita", "production",
                    "Natural Nepali voice with crisp Himalayan diction and natural cadence.",
                    true, true, PROVIDER_GOOGLE, 5000,
                    List.of("google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("sunita", "Sunita", "Female", "Crisp Himalayan Diction", true, "google-hosted"),
                            new TtsLanguageInfo.VoiceOption("rohit", "Rohit", "Male", "Narrative", false, "bodhan")
                    )),

            // 15. Odia — ଓଡ଼ିଆ (Production via Sarvam / Bodhan)
            new LanguageEntry("or", "Odia", "ଓଡ଼ିଆ", "Odia", "ory_Orya",
                    MODEL_SARVAM_V4, PROVIDER_SARVAM, "aditi", "production",
                    "Expressive Odia voice with authentic eastern phonetics, rounded vowels, and natural prosody.",
                    true, true, PROVIDER_SARVAM, 2500,
                    List.of("sarvam", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("aditi", "Aditi", "Female", "Expressive & Melodious", true, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("shubh", "Shubh", "Male", "Confident", false, "sarvam")
                    )),

            // 16. Punjabi — ਪੰਜਾਬੀ (Production)
            new LanguageEntry("pa", "Punjabi", "ਪੰਜਾਬੀ", "Gurmukhi", "pan_Guru",
                    MODEL_SARVAM_V4, PROVIDER_SARVAM, "shubh", "production",
                    "Energetic Punjabi voice with authentic Gurmukhi pronunciation and tonal inflection.",
                    true, true, PROVIDER_GOOGLE, 2500,
                    List.of("sarvam", "google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("shubh", "Shubh", "Male", "Energetic & Confident", true, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("rohit", "Rohit", "Male", "Authentic Gurmukhi Tone", false, "google-hosted"),
                            new TtsLanguageInfo.VoiceOption("simran", "Simran", "Female", "Melodious", false, "sarvam")
                    )),

            // 17. Sanskrit — संस्कृतम् (Preview Tier)
            new LanguageEntry("sa", "Sanskrit", "संस्कृतम्", "Devanagari", "san_Deva",
                    MODEL_BODHAN, PROVIDER_BODHAN, "sunita", "preview",
                    "Classical Sanskrit voice adhering to Paninian phonetics. Native LLM text generation supported; voice synthesis requires Bodhan credentials.",
                    true, false, "None", 2500,
                    List.of("bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("sunita", "Sunita", "Female", "Classical Vedic Phrasing", true, "bodhan"),
                            new TtsLanguageInfo.VoiceOption("suresh", "Suresh", "Male", "Paninian Recitation", false, "bodhan")
                    )),

            // 18. Santali — ᱥᱟᱱᱛᱟᱲᱤ (Preview Tier)
            new LanguageEntry("sat", "Santali", "ᱥᱟᱱᱛᱟᱲᱤ", "Ol Chiki", "sat_Olck",
                    MODEL_BODHAN, PROVIDER_BODHAN, "aditi", "preview",
                    "Santali indigenous voice supporting the Ol Chiki writing system. Native LLM generation supported; voice requires Bodhan credentials.",
                    true, false, "None", 2500,
                    List.of("bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("aditi", "Aditi", "Female", "Ol Chiki Articulation", true, "bodhan")
                    )),

            // 19. Sindhi — سنڌي / सिन्धी (Preview Tier)
            new LanguageEntry("sd", "Sindhi", "سنڌي / सिन्धी", "Perso-Arabic / Devanagari", "snd_Arab",
                    MODEL_BODHAN, PROVIDER_BODHAN, "sunita", "preview",
                    "Sindhi voice with dual Perso-Arabic and Devanagari support. Native LLM generation supported; voice requires Bodhan credentials.",
                    true, false, "None", 2500,
                    List.of("bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("sunita", "Sunita", "Female", "Sindhi Phonology", true, "bodhan")
                    )),

            // 20. Tamil — தமிழ் (Production)
            new LanguageEntry("ta", "Tamil", "தமிழ்", "Tamil", "tam_Taml",
                    MODEL_SARVAM_V4, PROVIDER_SARVAM, "shubh", "production",
                    "Classical Tamil voice with authentic Dravidian rhythm, natural vowel quantity, and precise articulation.",
                    true, true, PROVIDER_GOOGLE, 2500,
                    List.of("sarvam", "google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("shubh", "Shubh", "Male", "Crisp & Articulate", true, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("jaya", "Jaya", "Female", "Classical Dravidian Rhythm", false, "google-hosted"),
                            new TtsLanguageInfo.VoiceOption("priya", "Priya", "Female", "Natural & Expressive", false, "sarvam")
                    )),

            // 21. Telugu — తెలుగు (Production)
            new LanguageEntry("te", "Telugu", "తెలుగు", "Telugu", "tel_Telu",
                    MODEL_SARVAM_V4, PROVIDER_SARVAM, "shubh", "production",
                    "Lyrical Telugu voice with natural vowel endings, fluid cadence, and crisp pronunciation.",
                    true, true, PROVIDER_GOOGLE, 2500,
                    List.of("sarvam", "google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("shubh", "Shubh", "Male", "Confident & Lyrical", true, "sarvam"),
                            new TtsLanguageInfo.VoiceOption("prakash", "Prakash", "Male", "Classical Melodic Flow", false, "google-hosted"),
                            new TtsLanguageInfo.VoiceOption("priya", "Priya", "Female", "Clear & Expressive", false, "sarvam")
                    )),

            // 22. Urdu — اردو (Production via Google Hosted)
            new LanguageEntry("ur", "Urdu", "اردو", "Perso-Arabic (Nastaliq)", "urd_Arab",
                    MODEL_GOOGLE, PROVIDER_GOOGLE, "rohit", "production",
                    "Polished Urdu voice with classical Nastaliq inflection, elegant diction, and zero-downtime serving.",
                    true, true, PROVIDER_GOOGLE, 5000,
                    List.of("google-hosted", "bodhan"),
                    List.of(
                            new TtsLanguageInfo.VoiceOption("rohit", "Rohit", "Male", "Nastaliq Diction", true, "google-hosted"),
                            new TtsLanguageInfo.VoiceOption("rehan", "Rehan", "Male", "Polished & Formal", false, "bodhan")
                    ))
    );

    private static final Map<String, LanguageEntry> BY_CODE = new LinkedHashMap<>();
    static {
        for (LanguageEntry entry : ALL_LANGUAGES) {
            BY_CODE.put(entry.getCode().toLowerCase(), entry);
        }
    }

    public static List<LanguageEntry> getAllLanguages() {
        return ALL_LANGUAGES;
    }

    public static Optional<LanguageEntry> findByCode(String code) {
        if (code == null || code.isBlank()) return Optional.empty();
        return Optional.ofNullable(BY_CODE.get(code.trim().toLowerCase()));
    }

    public static boolean isSupported(String code) {
        if (code == null) return false;
        return BY_CODE.containsKey(code.trim().toLowerCase());
    }

    public static boolean isProduction(String code) {
        Optional<LanguageEntry> entry = findByCode(code);
        return entry.isPresent() && "production".equalsIgnoreCase(entry.get().getStatus());
    }

    public static String normalizeCode(String code) {
        if (code == null || code.isBlank()) return "en";
        String lower = code.trim().toLowerCase();

        // Exact match
        if (BY_CODE.containsKey(lower)) return lower;

        // Common aliases and prefixes
        if (lower.startsWith("hin") || lower.contains("hindi") || lower.contains("हिंदी") || lower.contains("हिन्दी")) return "hi";
        if (lower.startsWith("mar") || lower.contains("marathi") || lower.contains("मराठी")) return "mr";
        if (lower.startsWith("ben") || lower.contains("bengali") || lower.contains("বাংলা")) return "bn";
        if (lower.startsWith("guj") || lower.contains("gujarati") || lower.contains("ગુજરાતી")) return "gu";
        if (lower.startsWith("tam") || lower.contains("tamil") || lower.contains("தமிழ்")) return "ta";
        if (lower.startsWith("tel") || lower.contains("telugu") || lower.contains("తెలుగు")) return "te";
        if (lower.startsWith("kan") || lower.contains("kannada") || lower.contains("ಕನ್ನಡ")) return "kn";
        if (lower.startsWith("mal") || lower.contains("malayalam") || lower.contains("മലയാളം")) return "ml";
        if (lower.startsWith("pun") || lower.contains("punjabi") || lower.contains("ਪੰਜਾਬੀ")) return "pa";
        if (lower.startsWith("urd") || lower.contains("urdu") || lower.contains("اردو")) return "ur";
        if (lower.startsWith("nep") || lower.contains("nepali") || lower.contains("नेपाली")) return "ne";
        if (lower.startsWith("ass") || lower.startsWith("asm") || lower.contains("assamese") || lower.contains("অসমীয়া")) return "as";
        if (lower.startsWith("odi") || lower.startsWith("ory") || lower.contains("odia") || lower.contains("ଓଡ଼ିଆ") || lower.contains("oriya")) return "or";
        if (lower.startsWith("sant") || lower.contains("santali") || lower.contains("ᱥᱟᱱᱛᱟᱲᱤ")) return "sat";
        if (lower.startsWith("sansk") || lower.contains("sanskrit") || lower.contains("संस्कृत") || "sa".equals(lower)) return "sa";
        if (lower.startsWith("kas") || lower.contains("kashmiri") || lower.contains("کٲشُر") || lower.contains("कॉशुर") || "ks".equals(lower)) return "ks";
        if (lower.startsWith("kon") || lower.startsWith("kok") || lower.contains("konkani") || lower.contains("कोंकणी")) return "kok";
        if (lower.startsWith("mai") || lower.contains("maithili") || lower.contains("मैथिली")) return "mai";
        if (lower.startsWith("mni") || lower.contains("manipuri") || lower.contains("meitei") || lower.contains("মৈতৈ")) return "mni";
        if (lower.startsWith("sin") || lower.startsWith("snd") || lower.contains("sindhi") || lower.contains("سنڌي") || lower.contains("सिन्धी") || "sd".equals(lower)) return "sd";
        if (lower.startsWith("bod") || lower.startsWith("brx") || lower.contains("bodo") || lower.contains("बड़ो")) return "brx";
        if (lower.startsWith("dog") || lower.startsWith("doi") || lower.contains("dogri") || lower.contains("डोगरी")) return "doi";

        return "en";
    }
}
