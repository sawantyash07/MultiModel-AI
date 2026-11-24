package com.coderarmy.ragsupport.hub.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Prompt Understanding & Fidelity Engine.
 * Converts user requests into structured specifications while preserving exact intent,
 * constraints, counts, subjects, text-in-image, and styles.
 *
 * Enforces the 8 Prompt Fidelity Rules:
 * 1. Treat user prompt as the source of truth.
 * 2. Preserve all explicit requirements and constraints.
 * 3. Never substitute requested subjects.
 * 4. Never invent contradicting elements.
 * 5. Do not transform technical diagrams into decorative art.
 * 6. Never omit requested objects or alter quantities.
 * 7. Respect negative instructions ("no text", "white background", "no people").
 * 8. Handle simple requests simply without unwanted cinematic bloat.
 */
@Service
public class PromptUnderstandingService {

    private static final Logger log = LoggerFactory.getLogger(PromptUnderstandingService.class);

    public static class PromptSpecification {
        private String originalPrompt;
        private String cleanedPrompt;
        private String subject;
        private String action;
        private String environment;
        private String composition;
        private String appearance;
        private String style;
        private String textInImage;
        private String resolvedEntity;
        private String resolvedClothing;
        private String likenessDetails;
        private boolean entityResolved = false;
        private List<String> counts = new ArrayList<>();
        private List<String> negativeConstraints = new ArrayList<>();
        private List<String> referenceGuidance = new ArrayList<>();
        private String aspectRatio = "1:1";
        private int width = 1024;
        private int height = 1024;
        private String modelSpecificPrompt;
        private String negativePrompt;
        private boolean simpleRequest = false;
        private boolean enhancementApplied = false;

        public String getOriginalPrompt() { return originalPrompt; }
        public void setOriginalPrompt(String originalPrompt) { this.originalPrompt = originalPrompt; }

        public String getCleanedPrompt() { return cleanedPrompt; }
        public void setCleanedPrompt(String cleanedPrompt) { this.cleanedPrompt = cleanedPrompt; }

        public String getSubject() { return subject; }
        public void setSubject(String subject) { this.subject = subject; }

        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }

        public String getEnvironment() { return environment; }
        public void setEnvironment(String environment) { this.environment = environment; }

        public String getComposition() { return composition; }
        public void setComposition(String composition) { this.composition = composition; }

        public String getAppearance() { return appearance; }
        public void setAppearance(String appearance) { this.appearance = appearance; }

        public String getStyle() { return style; }
        public void setStyle(String style) { this.style = style; }

        public String getTextInImage() { return textInImage; }
        public void setTextInImage(String textInImage) { this.textInImage = textInImage; }

        public String getResolvedEntity() { return resolvedEntity; }
        public void setResolvedEntity(String resolvedEntity) { this.resolvedEntity = resolvedEntity; }

        public String getResolvedClothing() { return resolvedClothing; }
        public void setResolvedClothing(String resolvedClothing) { this.resolvedClothing = resolvedClothing; }

        public String getLikenessDetails() { return likenessDetails; }
        public void setLikenessDetails(String likenessDetails) { this.likenessDetails = likenessDetails; }

        public boolean isEntityResolved() { return entityResolved; }
        public void setEntityResolved(boolean entityResolved) { this.entityResolved = entityResolved; }

        public List<String> getCounts() { return counts; }
        public void setCounts(List<String> counts) { this.counts = counts; }

        public List<String> getNegativeConstraints() { return negativeConstraints; }
        public void setNegativeConstraints(List<String> negativeConstraints) { this.negativeConstraints = negativeConstraints; }

        public List<String> getReferenceGuidance() { return referenceGuidance; }
        public void setReferenceGuidance(List<String> referenceGuidance) { this.referenceGuidance = referenceGuidance; }

        public String getAspectRatio() { return aspectRatio; }
        public void setAspectRatio(String aspectRatio) { this.aspectRatio = aspectRatio; }

        public int getWidth() { return width; }
        public void setWidth(int width) { this.width = width; }

        public int getHeight() { return height; }
        public void setHeight(int height) { this.height = height; }

        public String getModelSpecificPrompt() { return modelSpecificPrompt; }
        public void setModelSpecificPrompt(String modelSpecificPrompt) { this.modelSpecificPrompt = modelSpecificPrompt; }

        public String getNegativePrompt() { return negativePrompt; }
        public void setNegativePrompt(String negativePrompt) { this.negativePrompt = negativePrompt; }

        public boolean isSimpleRequest() { return simpleRequest; }
        public void setSimpleRequest(boolean simpleRequest) { this.simpleRequest = simpleRequest; }

        public boolean isEnhancementApplied() { return enhancementApplied; }
        public void setEnhancementApplied(boolean enhancementApplied) { this.enhancementApplied = enhancementApplied; }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("originalPrompt", originalPrompt);
            map.put("cleanedPrompt", cleanedPrompt);
            map.put("subject", subject);
            map.put("resolvedEntity", resolvedEntity);
            map.put("resolvedClothing", resolvedClothing);
            map.put("likenessDetails", likenessDetails);
            map.put("entityResolved", entityResolved);
            map.put("action", action);
            map.put("environment", environment);
            map.put("composition", composition);
            map.put("appearance", appearance);
            map.put("style", style);
            map.put("textInImage", textInImage);
            map.put("counts", counts);
            map.put("negativeConstraints", negativeConstraints);
            map.put("referenceGuidance", referenceGuidance);
            map.put("aspectRatio", aspectRatio);
            map.put("width", width);
            map.put("height", height);
            map.put("isSimpleRequest", simpleRequest);
            map.put("enhancementApplied", enhancementApplied);
            map.put("modelSpecificPrompt", modelSpecificPrompt);
            return map;
        }
    }

    // RegEx patterns for fidelity extraction
    private static final Pattern QUOTED_TEXT_PATTERN = Pattern.compile("[\"']([^\"']{1,50})[\"']");
    private static final Pattern TEXT_KEYWORD_PATTERN = Pattern.compile("\\b(?:text|words?|saying|labeled|reads?|caption)\\s+[\"']?([A-Za-z0-9 !?.,'-]{1,40})[\"']?", Pattern.CASE_INSENSITIVE);
    private static final Pattern COUNT_PATTERN = Pattern.compile("\\b(exactly\\s+\\w+|\\d+|one|two|three|four|five|six|seven|eight|nine|ten|pair of|single|solitary)\\s+([a-zA-Z]+)", Pattern.CASE_INSENSITIVE);

    public PromptSpecification analyzePrompt(String prompt, String requestedAspect, String targetModelId, boolean allowEnhancement) {
        PromptSpecification spec = new PromptSpecification();
        String clean = prompt != null ? prompt.trim() : "";
        spec.setOriginalPrompt(clean);

        if (clean.isEmpty()) {
            spec.setModelSpecificPrompt("");
            spec.setNegativePrompt("");
            return spec;
        }

        // Clean conversational noise while preserving original prompt as the source of truth
        String cleaned = cleanConversationalPrefixes(clean);
        spec.setCleanedPrompt(cleaned);

        String lower = clean.toLowerCase();
        String lowerCleaned = cleaned.toLowerCase();

        // 1. Detect Aspect Ratio & Dimensions
        resolveAspectRatioAndDimensions(lower, requestedAspect, spec);

        // 2. Resolve Domain Entities (e.g. Sports Personalities, Jerseys, Iconic Landmarks)
        resolveDomainEntities(cleaned, lowerCleaned, spec);

        // 3. Detect Text in Image
        extractTextInImage(clean, lower, spec);

        // 4. Detect Counts and Quantities
        extractCounts(clean, spec);

        // 5. Detect Explicit Negative Constraints & Exclusions
        extractNegativeConstraints(lower, spec);

        // 6. Detect Requested Style
        extractStyle(lower, spec);

        // 7. Detect Composition and Framing
        extractComposition(lower, spec);

        // 8. Detect Subject & Environment
        extractSubjectAndEnvironment(cleaned, lowerCleaned, spec);

        // 9. Classify whether this is a minimalist / simple request
        boolean isSimple = isSimpleRequest(lower, spec);
        spec.setSimpleRequest(isSimple);

        // 10. Synthesize model-specific optimized prompt preserving all constraints
        buildModelSpecificPrompts(spec, targetModelId, allowEnhancement);

        log.info("[PromptFidelity] Analyzed prompt: original='{}', model='{}', entityResolved={}, entity='{}', clothing='{}', constraints={}",
                clean, targetModelId, spec.isEntityResolved(), spec.getResolvedEntity(), spec.getResolvedClothing(), spec.getNegativeConstraints());

        return spec;
    }

    private String cleanConversationalPrefixes(String input) {
        if (input == null) return "";
        String s = input.trim();
        // Remove common conversational command framing
        s = s.replaceAll("(?i)^(?:please\\s+)?(?:give\\s+me|show\\s+me|generate|create|draw|make|paint|synthesize|render)\\s+(?:(?:an?|the)\\s+)?(?:image|picture|photo|photograph|portrait|pic|rendering)\\s+of\\s+", "");
        s = s.replaceAll("(?i)^(?:please\\s+)?(?:generate|create|draw|make|paint|synthesize|render)\\s+", "");
        // Clean grammatical slips like "of in Jersey of" -> "wearing the jersey of"
        s = s.replaceAll("(?i)\\bof\\s+in\\s+(?:jersey|shirt|uniform|kit)\\s+of\\s+", "wearing the official jersey of ");
        s = s.replaceAll("(?i)\\bin\\s+(?:jersey|shirt|uniform|kit)\\s+of\\s+", "wearing the official jersey of ");
        s = s.replaceAll("(?i)\\bof\\s+in\\s+", "in ");
        return s.trim();
    }

    private void resolveDomainEntities(String cleaned, String lowerCleaned, PromptSpecification spec) {
        // --- 1. Cricket / Sports Personalities ---
        // MS Dhoni
        if (Pattern.compile("(?i)\\b(m\\.?s\\.?\\s*dhoni|msdhoni|dhoni|mahendra\\s+singh\\s+dhoni)\\b").matcher(cleaned).find()) {
            spec.setResolvedEntity("Indian cricket icon Mahendra Singh Dhoni (MS Dhoni)");
            spec.setLikenessDetails("accurate facial likeness of MS Dhoni, distinct jawline, calm focused expression, athletic physique, iconic short dark hair");
            spec.setEntityResolved(true);
        } else if (Pattern.compile("(?i)\\b(virat\\s+kohli|virat|kohli)\\b").matcher(cleaned).find()) {
            spec.setResolvedEntity("Indian cricket icon Virat Kohli");
            spec.setLikenessDetails("accurate facial likeness of Virat Kohli, sharp groomed beard, intense determined expression, athletic build");
            spec.setEntityResolved(true);
        } else if (Pattern.compile("(?i)\\b(rohit\\s+sharma|rohit)\\b").matcher(cleaned).find()) {
            spec.setResolvedEntity("Indian cricket captain Rohit Sharma");
            spec.setLikenessDetails("accurate facial likeness of Rohit Sharma, neat beard, composed leadership presence, athletic build");
            spec.setEntityResolved(true);
        } else if (Pattern.compile("(?i)\\b(sachin\\s+tendulkar|sachin)\\b").matcher(cleaned).find()) {
            spec.setResolvedEntity("Legendary Indian cricketer Sachin Tendulkar");
            spec.setLikenessDetails("accurate facial likeness of Sachin Tendulkar, iconic curly hair, warm smile, master batsman presence");
            spec.setEntityResolved(true);
        }

        // --- 2. Team Uniforms & Jerseys ---
        // Chennai Super Kings (CSK)
        if (Pattern.compile("(?i)\\b(csk|chennai\\s+super\\s+kings)\\b").matcher(cleaned).find()) {
            spec.setResolvedClothing("official Chennai Super Kings (CSK) cricket uniform: vibrant canary-yellow jersey with royal blue collar and shoulder accents, roaring lion crest emblem on left chest, matching athletic yellow cricket trousers");
            spec.setEntityResolved(true);
        } else if (Pattern.compile("(?i)\\b(mumbai\\s+indians|mi)\\b").matcher(cleaned).find()) {
            spec.setResolvedClothing("official Mumbai Indians (MI) cricket uniform: deep cobalt blue jersey with metallic gold trim on shoulders and sides, team crest on chest, matching trousers");
            spec.setEntityResolved(true);
        } else if (Pattern.compile("(?i)\\b(royal\\s+challengers(\\s+bengaluru)?|rcb)\\b").matcher(cleaned).find()) {
            spec.setResolvedClothing("official Royal Challengers Bengaluru (RCB) cricket uniform: bold crimson red and midnight black jersey with metallic gold lion crest, matching black trousers");
            spec.setEntityResolved(true);
        } else if (Pattern.compile("(?i)\\b(team\\s+india|indian\\s+cricket\\s+team|indian\\s+jersey|bcci)\\b").matcher(cleaned).find()) {
            spec.setResolvedClothing("official Team India national cricket uniform: vibrant sky-blue/navy-blue jersey with saffron/orange accents, BCCI tricolor emblem on chest, matching blue athletic cricket trousers");
            spec.setEntityResolved(true);
        } else if (Pattern.compile("(?i)\\b(kolkata\\s+knight\\s+riders|kkr)\\b").matcher(cleaned).find()) {
            spec.setResolvedClothing("official Kolkata Knight Riders (KKR) cricket uniform: royal purple and gold jersey with Corinthian helmet crest");
            spec.setEntityResolved(true);
        } else if (Pattern.compile("(?i)\\b(real\\s+madrid)\\b").matcher(cleaned).find()) {
            spec.setResolvedClothing("official Real Madrid football kit: all-white jersey with club crest on chest");
            spec.setEntityResolved(true);
        } else if (Pattern.compile("(?i)\\b(barcelona|barca)\\b").matcher(cleaned).find()) {
            spec.setResolvedClothing("official FC Barcelona football kit: classic blaugrana deep red and blue vertical striped jersey with club crest");
            spec.setEntityResolved(true);
        } else if (Pattern.compile("(?i)\\b(argentina\\s+jersey|argentina\\s+kit|argentina\\s+football)\\b").matcher(cleaned).find()) {
            spec.setResolvedClothing("official Argentina national team football kit: sky-blue and white vertical stripes with gold AFA crest");
            spec.setEntityResolved(true);
        }
    }

    private void resolveAspectRatioAndDimensions(String lower, String requestedAspect, PromptSpecification spec) {
        String aspect = requestedAspect != null && !requestedAspect.isBlank() ? requestedAspect.trim() : "1:1";

        if ("16:9".equals(aspect) || lower.contains("16:9") || lower.contains("landscape") || lower.contains("wallpaper") || lower.contains("widescreen")) {
            spec.setAspectRatio("16:9");
            spec.setWidth(1024);
            spec.setHeight(576);
        } else if ("9:16".equals(aspect) || lower.contains("9:16") || lower.contains("portrait") || lower.contains("vertical") || lower.contains("story")) {
            spec.setAspectRatio("9:16");
            spec.setWidth(576);
            spec.setHeight(1024);
        } else if ("4:3".equals(aspect) || lower.contains("4:3")) {
            spec.setAspectRatio("4:3");
            spec.setWidth(768);
            spec.setHeight(576);
        } else if ("3:4".equals(aspect) || lower.contains("3:4")) {
            spec.setAspectRatio("3:4");
            spec.setWidth(576);
            spec.setHeight(768);
        } else {
            spec.setAspectRatio("1:1");
            spec.setWidth(1024);
            spec.setHeight(1024);
        }
    }

    private void extractTextInImage(String clean, String lower, PromptSpecification spec) {
        Matcher m1 = QUOTED_TEXT_PATTERN.matcher(clean);
        if (m1.find()) {
            spec.setTextInImage(m1.group(1));
            return;
        }
        Matcher m2 = TEXT_KEYWORD_PATTERN.matcher(clean);
        if (m2.find()) {
            spec.setTextInImage(m2.group(1).trim());
        }
    }

    private void extractCounts(String clean, PromptSpecification spec) {
        Matcher m = COUNT_PATTERN.matcher(clean);
        while (m.find()) {
            String countPhrase = m.group(1) + " " + m.group(2);
            spec.getCounts().add(countPhrase.toLowerCase());
        }
    }

    private void extractNegativeConstraints(String lower, PromptSpecification spec) {
        List<String> negs = spec.getNegativeConstraints();
        List<String> negTokens = new ArrayList<>();

        if (lower.contains("plain white background") || lower.contains("clean white background") ||
                lower.contains("solid white background") || lower.contains("white backdrop") ||
                lower.contains("isolated on white") || lower.contains("pure white background")) {
            negs.add("plain white background (no background scenery)");
            negTokens.add("background clutter, complex scenery, floor texture, shadows, gradient");
        }

        if (lower.contains("no text") || lower.contains("without text") || lower.contains("no words") || lower.contains("no lettering")) {
            negs.add("no text or lettering");
            negTokens.add("text, words, letters, typography, watermark, logo, sign, signature");
        }

        if (lower.contains("no people") || lower.contains("without people") || lower.contains("no persons") || lower.contains("no humans")) {
            negs.add("no people or humans");
            negTokens.add("people, human, person, face, crowd, silhouette");
        }

        if (lower.contains("no shadows") || lower.contains("shadowless")) {
            negs.add("no harsh shadows");
            negTokens.add("harsh shadows, drop shadows, dark shadows");
        }

        if (lower.contains("no other objects") || lower.contains("nothing else") || lower.contains("only the")) {
            negs.add("strictly solitary (no extra objects)");
            negTokens.add("extra objects, clutter, multiple items, surrounding debris");
        }

        // Generic patterns for "no X", "without X", "exclude X"
        Pattern p = Pattern.compile("\\b(?:no|without|excluding|exclude)\\s+([a-zA-Z0-9 ]{2,25})(?:,|$|\\.)", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(lower);
        while (m.find()) {
            String excluded = m.group(1).trim();
            if (!excluded.isEmpty() && !excluded.equals("text") && !excluded.equals("people") && !excluded.equals("shadows")) {
                negs.add("exclude " + excluded);
                negTokens.add(excluded);
            }
        }

        if (!negTokens.isEmpty()) {
            spec.setNegativePrompt(String.join(", ", negTokens));
        } else {
            // Default quality negative tokens for diffusion models
            spec.setNegativePrompt("blurry, low quality, distorted, extra limbs, watermark, artifacts, bad anatomy");
        }
    }

    private void extractStyle(String lower, PromptSpecification spec) {
        if (lower.contains("photorealistic") || lower.contains("photograph") || lower.contains("photo of") || lower.contains("dslr")) {
            spec.setStyle("Photorealistic Photography");
        } else if (lower.contains("technical illustration") || lower.contains("technical drawing") || lower.contains("blueprint") || lower.contains("schematic") || lower.contains("diagram")) {
            spec.setStyle("Technical Illustration & Diagram");
        } else if (lower.contains("line art") || lower.contains("line-art") || lower.contains("vector") || lower.contains("icon")) {
            spec.setStyle("Clean Line Art / Vector Graphic");
        } else if (lower.contains("anime") || lower.contains("manga")) {
            spec.setStyle("Anime / Manga Art");
        } else if (lower.contains("3d render") || lower.contains("3d model") || lower.contains("cgi")) {
            spec.setStyle("3D Digital Render");
        } else if (lower.contains("watercolor") || lower.contains("oil painting") || lower.contains("painting")) {
            spec.setStyle("Traditional Painting");
        } else if (lower.contains("minimalist") || lower.contains("simple")) {
            spec.setStyle("Minimalist");
        } else {
            spec.setStyle("Natural Aesthetic");
        }
    }

    private void extractComposition(String lower, PromptSpecification spec) {
        if (lower.contains("macro") || lower.contains("extreme close-up")) {
            spec.setComposition("Macro close-up");
        } else if (lower.contains("close-up") || lower.contains("closeup")) {
            spec.setComposition("Close-up framing");
        } else if (lower.contains("wide-angle") || lower.contains("wide angle") || lower.contains("panoramic")) {
            spec.setComposition("Wide-angle framing");
        } else if (lower.contains("aerial") || lower.contains("bird's eye") || lower.contains("top-down")) {
            spec.setComposition("Aerial top-down view");
        } else if (lower.contains("side profile") || lower.contains("side view")) {
            spec.setComposition("Side profile view");
        } else if (lower.contains("isometric")) {
            spec.setComposition("Isometric perspective");
        } else if (lower.contains("centered") || lower.contains("in the center")) {
            spec.setComposition("Centered subject placement");
        }
    }

    private void extractSubjectAndEnvironment(String clean, String lower, PromptSpecification spec) {
        // Strip common command phrases
        String stripped = clean
                .replaceAll("(?i)^(?:generate|create|draw|make|paint|synthesize|show me|give me|render)\\s+(?:an?\\s+)?(?:image|picture|photo|illustration|drawing|render)\\s+of\\s+", "")
                .replaceAll("(?i)^(?:generate|create|draw|make|paint|synthesize|render)\\s+", "");

        spec.setSubject(stripped);

        // Detect environment
        Pattern envPat = Pattern.compile("(?:on|in|inside|at|beside|near|surrounded by)\\s+([^,.]+)", Pattern.CASE_INSENSITIVE);
        Matcher envMatcher = envPat.matcher(stripped);
        if (envMatcher.find()) {
            spec.setEnvironment(envMatcher.group(0).trim());
        }
    }

    private boolean isSimpleRequest(String lower, PromptSpecification spec) {
        if (lower.contains("simple") || lower.contains("minimalist") ||
                lower.contains("white background") || lower.contains("plain background") ||
                lower.contains("isolated on white") || lower.contains("clean white") ||
                lower.contains("icon") || lower.contains("vector")) {
            return true;
        }
        // Very short prompts with direct object nouns
        return spec.getOriginalPrompt().split("\\s+").length <= 8 &&
                !lower.contains("cinematic") && !lower.contains("epic") && !lower.contains("fantasy");
    }

    private void buildModelSpecificPrompts(PromptSpecification spec, String targetModelId, boolean allowEnhancement) {
        String original = spec.getOriginalPrompt();
        String mId = targetModelId != null ? targetModelId.toLowerCase() : "";

        // If domain entities are resolved (e.g. MS Dhoni in CSK jersey),
        // synthesize an unambiguous, high-fidelity visual description so diffusion models correctly depict the person and uniform
        if (spec.isEntityResolved()) {
            StringBuilder sb = new StringBuilder();
            sb.append("A realistic, high-detail professional photograph of ");
            if (spec.getResolvedEntity() != null) {
                sb.append(spec.getResolvedEntity());
                if (spec.getLikenessDetails() != null) {
                    sb.append(", ").append(spec.getLikenessDetails());
                }
            } else {
                sb.append(spec.getSubject());
            }

            if (spec.getResolvedClothing() != null) {
                sb.append(", wearing ").append(spec.getResolvedClothing());
            }

            if (spec.getEnvironment() != null && !spec.getEnvironment().isBlank()) {
                sb.append(", ").append(spec.getEnvironment());
            } else {
                sb.append(", on a professional cricket pitch stadium under bright stadium lights");
            }

            if (spec.getComposition() != null) {
                sb.append(", ").append(spec.getComposition());
            }

            if (spec.getTextInImage() != null && !spec.getTextInImage().isBlank()) {
                sb.append(", displaying the exact text '").append(spec.getTextInImage()).append("' in clear legible typography");
            }

            if (mId.contains("gemini") || mId.contains("gpt-image")) {
                if (!spec.getNegativeConstraints().isEmpty()) {
                    sb.append(". Strict negative constraints: ").append(String.join("; ", spec.getNegativeConstraints()));
                }
            }

            spec.setModelSpecificPrompt(sb.toString().trim());
            spec.setEnhancementApplied(true);
            return;
        }

        // If enhancement is disabled or prompt is already simple/exact, preserve original prompt strictly
        if (!allowEnhancement || spec.isSimpleRequest()) {
            spec.setEnhancementApplied(false);
            spec.setModelSpecificPrompt(original);
            return;
        }

        spec.setEnhancementApplied(true);
        StringBuilder sb = new StringBuilder();

        // 1. Maintain primary subject and actions directly from original prompt
        sb.append(spec.getSubject());

        // 2. Specific styles
        if (spec.getStyle() != null && !"Natural Aesthetic".equals(spec.getStyle())) {
            sb.append(", ").append(spec.getStyle());
        }

        // 3. Composition
        if (spec.getComposition() != null) {
            sb.append(", ").append(spec.getComposition());
        }

        // 4. Exact text preservation
        if (spec.getTextInImage() != null && !spec.getTextInImage().isBlank()) {
            sb.append(", displaying the exact text '").append(spec.getTextInImage()).append("' in clear legible typography");
        }

        // 5. Explicit negative constraints appended naturally for frontier models like Gemini / GPT
        if (mId.contains("gemini") || mId.contains("gpt-image")) {
            if (!spec.getNegativeConstraints().isEmpty()) {
                sb.append(". Strict negative constraints: ").append(String.join("; ", spec.getNegativeConstraints()));
            }
        }

        spec.setModelSpecificPrompt(sb.toString().trim());
    }
}
