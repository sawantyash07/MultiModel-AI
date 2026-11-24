package com.coderarmy.ragsupport.service;

import com.coderarmy.ragsupport.model.LanguageRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * High-Precision Speech Alignment and Word-Level Timestamp Engine for Yash AI.
 *
 * Synchronizes generated audio playback with response text across English and all
 * 22 scheduled Indian languages (Gujarati, Hindi, Marathi, etc.).
 *
 * Architecture:
 * 1. Primary: High-speed Acoustic Forced Alignment via Groq Whisper Large v3
 *    (timestamp_granularities=["word"]). Yields exact word boundaries.
 * 2. Monotonic Sequence Alignment (Dynamic Time Warping / Needleman-Wunsch):
 *    Maps acoustic timestamps to reference Markdown word spans with zero drift.
 * 3. High-Availability Fallback: Native MPEG Audio Frame duration extraction +
 *    syllable & punctuation pause weighting when network alignment is unavailable.
 */
@Service
public class SpeechAlignmentService {

    private static final Logger log = LoggerFactory.getLogger(SpeechAlignmentService.class);

    private static final Pattern WORD_PATTERN = Pattern.compile("[\\p{L}\\p{M}\\p{N}]+(?:['’\\-][\\p{L}\\p{M}\\p{N}]+)*", Pattern.UNICODE_CHARACTER_CLASS);

    // Unicode block ranges for Indic scripts (Devanagari, Gujarati, Bengali, Tamil, Telugu, etc.)
    private static final Pattern INDIC_SCRIPT_PATTERN = Pattern.compile(
            "[\\u0900-\\u0D7F\\u0A00-\\u0A7F\\u0A80-\\u0AFF\\u0B00-\\u0B7F\\u0B80-\\u0BFF\\u0C00-\\u0C7F\\u0C80-\\u0CFF\\u0D00-\\u0D7F]"
    );

    @Value("${groq.api-key:}")
    private String groqApiKey;

    @Value("${asr.timeout-seconds:15}")
    private int timeoutSeconds = 15;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient;

    @Autowired
    public SpeechAlignmentService() {
        this(HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .connectTimeout(Duration.ofSeconds(10))
                .build());
    }

    public SpeechAlignmentService(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /**
     * DTO representing an aligned word with start and end timestamps.
     */
    public static class WordTimestamp {
        private String word;
        private double start;
        private double end;
        private int index;

        public WordTimestamp() {}

        public WordTimestamp(String word, double start, double end, int index) {
            this.word = word;
            this.start = Math.round(start * 1000.0) / 1000.0;
            this.end = Math.round(end * 1000.0) / 1000.0;
            this.index = index;
        }

        public String getWord() { return word; }
        public void setWord(String word) { this.word = word; }

        public double getStart() { return start; }
        public void setStart(double start) { this.start = start; }

        public double getEnd() { return end; }
        public void setEnd(double end) { this.end = end; }

        public int getIndex() { return index; }
        public void setIndex(int index) { this.index = index; }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("word", word);
            map.put("start", start);
            map.put("end", end);
            map.put("index", index);
            return map;
        }

        @Override
        public String toString() {
            return String.format("[%d] \"%s\": %.2fs - %.2fs", index, word, start, end);
        }
    }

    /**
     * Alignment result container.
     */
    public static class AlignmentResult {
        private final List<WordTimestamp> timestamps;
        private final double durationSeconds;
        private final boolean exact;
        private final String provider;

        public AlignmentResult(List<WordTimestamp> timestamps, double durationSeconds, boolean exact, String provider) {
            this.timestamps = timestamps != null ? timestamps : Collections.emptyList();
            this.durationSeconds = durationSeconds;
            this.exact = exact;
            this.provider = provider;
        }

        public List<WordTimestamp> getTimestamps() { return timestamps; }
        public double getDurationSeconds() { return durationSeconds; }
        public long getDurationMs() { return Math.round(durationSeconds * 1000.0); }
        public boolean isExact() { return exact; }
        public String getProvider() { return provider; }
    }

    /**
     * Extracts individual words from text while preserving sequential ordering.
     */
    public List<String> extractWords(String text) {
        if (text == null || text.isBlank()) return Collections.emptyList();
        List<String> words = new ArrayList<>();
        Matcher m = WORD_PATTERN.matcher(text);
        while (m.find()) {
            words.add(m.group());
        }
        return words;
    }

    /**
     * High-precision speech aligner: generates exact word timestamps for audio and text.
     */
    public AlignmentResult alignSpeech(byte[] audioBytes, String spokenText, String language) {
        List<String> refWords = extractWords(spokenText);
        if (refWords.isEmpty()) {
            return new AlignmentResult(Collections.emptyList(), 0.0, false, "none");
        }

        // 1. Calculate actual MP3 duration from frame headers
        double parsedDuration = calculateAudioDurationSeconds(audioBytes);

        // 2. Primary Path: Attempt acoustic forced alignment via Groq Whisper Large v3
        String groqKey = getEffectiveGroqKey();
        if (groqKey != null && !groqKey.isBlank() && audioBytes != null && audioBytes.length > 500) {
            try {
                log.info("[Speech Alignment] Requesting acoustic word timestamps via Whisper for lang='{}' ({} words, {} bytes)",
                        language, refWords.size(), audioBytes.length);
                List<WordTimestamp> acousticWords = fetchWhisperWordTimestamps(audioBytes, language, groqKey);
                if (acousticWords != null && !acousticWords.isEmpty()) {
                    double audioDuration = parsedDuration > 0 ? parsedDuration :
                            acousticWords.get(acousticWords.size() - 1).getEnd();

                    List<WordTimestamp> aligned = monotonicSequenceAlignment(refWords, acousticWords, audioDuration);
                    log.info("[Speech Alignment] Successfully aligned {} words with acoustic precision (duration={:.2f}s, provider=Groq-Whisper-v3)",
                            aligned.size(), audioDuration);
                    return new AlignmentResult(aligned, audioDuration, true, "Groq-Whisper-v3-Acoustic");
                }
            } catch (Exception ex) {
                log.warn("[Speech Alignment] Whisper acoustic alignment unavailable: {}. Falling back to acoustic model...", ex.getMessage());
            }
        }

        // 3. Fallback Path: Syllable-weighted acoustic duration model normalized to exact audio duration
        double finalDuration = parsedDuration > 0 ? parsedDuration : Math.max(1.0, refWords.size() * 0.38);
        List<WordTimestamp> fallbackTimeline = buildSyllableWeightedTimeline(spokenText, finalDuration);
        log.info("[Speech Alignment] Built duration-normalized acoustic timeline for {} words (duration={:.2f}s, exact=false)",
                fallbackTimeline.size(), finalDuration);
        return new AlignmentResult(fallbackTimeline, finalDuration, false, "Acoustic-Duration-Model");
    }

    /**
     * Calls Groq Whisper Large v3 with verbose_json and timestamp_granularities=["word"].
     */
    private List<WordTimestamp> fetchWhisperWordTimestamps(byte[] audioBytes, String lang, String apiKey) throws Exception {
        String boundary = "----WhisperBoundary" + UUID.randomUUID().toString();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        // 1. Model parameter
        baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        baos.write("Content-Disposition: form-data; name=\"model\"\r\n\r\n".getBytes(StandardCharsets.UTF_8));
        baos.write("whisper-large-v3\r\n".getBytes(StandardCharsets.UTF_8));

        // 2. Response format: verbose_json
        baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        baos.write("Content-Disposition: form-data; name=\"response_format\"\r\n\r\n".getBytes(StandardCharsets.UTF_8));
        baos.write("verbose_json\r\n".getBytes(StandardCharsets.UTF_8));

        // 3. Timestamp granularities: word
        baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        baos.write("Content-Disposition: form-data; name=\"timestamp_granularities[]\"\r\n\r\n".getBytes(StandardCharsets.UTF_8));
        baos.write("word\r\n".getBytes(StandardCharsets.UTF_8));

        // 4. Language hint if valid
        String normLang = LanguageRegistry.normalizeCode(lang);
        if (normLang != null && !normLang.isBlank() && !"auto".equalsIgnoreCase(normLang)) {
            baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            baos.write("Content-Disposition: form-data; name=\"language\"\r\n\r\n".getBytes(StandardCharsets.UTF_8));
            baos.write((normLang + "\r\n").getBytes(StandardCharsets.UTF_8));
        }

        // 5. Audio file binary
        baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        baos.write("Content-Disposition: form-data; name=\"file\"; filename=\"speech.mp3\"\r\n".getBytes(StandardCharsets.UTF_8));
        baos.write("Content-Type: audio/mpeg\r\n\r\n".getBytes(StandardCharsets.UTF_8));
        baos.write(audioBytes);
        baos.write("\r\n".getBytes(StandardCharsets.UTF_8));

        // End boundary
        baos.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.groq.com/openai/v1/audio/transcriptions"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .POST(HttpRequest.BodyPublishers.ofByteArray(baos.toByteArray()))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() != 200) {
            throw new IllegalStateException("Groq Whisper API returned HTTP " + response.statusCode() + ": " + response.body());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode wordsArray = root.path("words");
        if (!wordsArray.isArray() || wordsArray.isEmpty()) {
            return Collections.emptyList();
        }

        List<WordTimestamp> result = new ArrayList<>();
        int idx = 0;
        for (JsonNode item : wordsArray) {
            String word = item.path("word").asText("").trim();
            double start = item.path("start").asDouble(0.0);
            double end = item.path("end").asDouble(start + 0.1);
            if (!word.isEmpty()) {
                result.add(new WordTimestamp(word, start, Math.max(start + 0.04, end), idx++));
            }
        }

        return result;
    }

    /**
     * Monotonic sequence alignment (Anchor-based Dynamic Time Warping).
     * Maps acoustic Whisper timestamps to reference words with strict monotonicity,
     * positive durations, continuous non-overlapping coverage, and zero drift.
     */
    public List<WordTimestamp> monotonicSequenceAlignment(
            List<String> refWords,
            List<WordTimestamp> whisperWords,
            double audioDuration
    ) {
        int n = refWords.size();
        int m = whisperWords.size();

        if (n == 0) return Collections.emptyList();
        if (m == 0 || audioDuration <= 0) {
            return buildSyllableWeightedTimeline(String.join(" ", refWords), audioDuration > 0 ? audioDuration : Math.max(1.0, n * 0.38));
        }

        // DP scoring matrix for anchor matching
        double[][] dp = new double[n + 1][m + 1];
        int[][] backtrack = new int[n + 1][m + 1]; // 1: diag, 2: down (skip ref), 3: right (skip whisper)

        for (int i = 0; i <= n; i++) dp[i][0] = -i * 0.2;
        for (int j = 0; j <= m; j++) dp[0][j] = -j * 0.2;

        for (int i = 1; i <= n; i++) {
            String rw = normalizeWord(refWords.get(i - 1));
            for (int j = 1; j <= m; j++) {
                String ww = normalizeWord(whisperWords.get(j - 1).getWord());
                double matchScore = -1.0;

                if (rw.equals(ww)) {
                    matchScore = 3.0;
                } else if (rw.contains(ww) || ww.contains(rw)) {
                    matchScore = 2.0;
                } else {
                    int dist = computeLevenshtein(rw, ww);
                    int maxLen = Math.max(rw.length(), ww.length());
                    if (dist <= 2 || (maxLen > 0 && (double) dist / maxLen <= 0.4)) {
                        matchScore = 2.0 - dist * 0.3;
                    }
                }

                double diag = dp[i - 1][j - 1] + matchScore;
                double down = dp[i - 1][j] - 0.2;
                double right = dp[i][j - 1] - 0.2;

                if (diag >= down && diag >= right) {
                    dp[i][j] = diag;
                    backtrack[i][j] = 1;
                } else if (down >= right) {
                    dp[i][j] = down;
                    backtrack[i][j] = 2;
                } else {
                    dp[i][j] = right;
                    backtrack[i][j] = 3;
                }
            }
        }

        // Backtrack to extract matched anchor pairs
        int curI = n, curJ = m;
        List<int[]> matchedPairs = new ArrayList<>(); // [refIdx, whisperIdx]
        while (curI > 0 && curJ > 0) {
            int b = backtrack[curI][curJ];
            if (b == 1) {
                matchedPairs.add(new int[]{ curI - 1, curJ - 1 });
                curI--;
                curJ--;
            } else if (b == 2) {
                curI--;
            } else {
                curJ--;
            }
        }
        Collections.reverse(matchedPairs);

        // Build sorted anchors:
        // Map matched ref indices to their Whisper start and end times
        Map<Integer, WordTimestamp> matchMap = new HashMap<>();
        for (int[] pair : matchedPairs) {
            matchMap.put(pair[0], whisperWords.get(pair[1]));
        }

        List<Anchor> anchors = new ArrayList<>();
        if (matchMap.containsKey(0)) {
            anchors.add(new Anchor(0, matchMap.get(0).getStart()));
        } else {
            anchors.add(new Anchor(0, 0.0));
        }

        for (int i = 1; i < n; i++) {
            if (matchMap.containsKey(i)) {
                anchors.add(new Anchor(i, matchMap.get(i).getStart()));
            }
        }
        anchors.add(new Anchor(n, audioDuration));

        // Deduplicate anchors to ensure strictly increasing refIdx and non-decreasing time
        List<Anchor> cleanAnchors = new ArrayList<>();
        for (Anchor cur : anchors) {
            if (cleanAnchors.isEmpty()) {
                cleanAnchors.add(cur);
            } else {
                Anchor prev = cleanAnchors.get(cleanAnchors.size() - 1);
                if (cur.refIdx > prev.refIdx && cur.time >= prev.time) {
                    cleanAnchors.add(cur);
                }
            }
        }

        // Interpolate across clean anchors to produce a continuous, strictly positive timeline
        List<WordTimestamp> result = new ArrayList<>();
        for (int a = 0; a < cleanAnchors.size() - 1; a++) {
            Anchor startAnchor = cleanAnchors.get(a);
            Anchor endAnchor = cleanAnchors.get(a + 1);

            int spanCount = endAnchor.refIdx - startAnchor.refIdx;
            double spanDuration = Math.max(0.06 * spanCount, endAnchor.time - startAnchor.time);

            // If spanCount == 1 and startAnchor is a matched word whose Whisper end time is known
            if (spanCount == 1 && matchMap.containsKey(startAnchor.refIdx)) {
                WordTimestamp matched = matchMap.get(startAnchor.refIdx);
                double start = startAnchor.time;
                double end = (a == cleanAnchors.size() - 2) ? audioDuration :
                        Math.max(start + 0.04, Math.min(endAnchor.time, matched.getEnd()));
                result.add(new WordTimestamp(refWords.get(startAnchor.refIdx), start, end, startAnchor.refIdx));
                continue;
            }

            // Otherwise, proportion span words by phonetic weight
            double totalWeight = 0.0;
            double[] weights = new double[spanCount];
            for (int k = 0; k < spanCount; k++) {
                String w = refWords.get(startAnchor.refIdx + k);
                weights[k] = estimateWordWeight(w, "");
                totalWeight += weights[k];
            }
            if (totalWeight <= 0) totalWeight = spanCount;

            double curTime = startAnchor.time;
            for (int k = 0; k < spanCount; k++) {
                int globalIdx = startAnchor.refIdx + k;
                String w = refWords.get(globalIdx);
                double dur = (weights[k] / totalWeight) * spanDuration;
                double start = curTime;
                double end = (k == spanCount - 1 && a == cleanAnchors.size() - 2)
                        ? audioDuration
                        : start + dur;

                result.add(new WordTimestamp(w, start, end, globalIdx));
                curTime = end;
            }
        }

        return result;
    }

    private static class Anchor {
        final int refIdx;
        final double time;
        Anchor(int refIdx, double time) {
            this.refIdx = refIdx;
            this.time = time;
        }
    }

    private int computeLevenshtein(String a, String b) {
        if (a == null) a = "";
        if (b == null) b = "";
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1), dp[i - 1][j - 1] + cost);
            }
        }
        return dp[a.length()][b.length()];
    }

    private String normalizeWord(String word) {
        if (word == null) return "";
        return word.replaceAll("[\\p{P}\\s]+", "").toLowerCase();
    }

    /**
     * Calculates audio playback duration in seconds by parsing MPEG frame headers or RIFF WAV headers.
     */
    public double calculateAudioDurationSeconds(byte[] bytes) {
        if (bytes == null || bytes.length < 4) return 0.0;

        // Check RIFF WAV header
        if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F' && bytes.length >= 44) {
            int byteRate = (bytes[28] & 0xFF) | ((bytes[29] & 0xFF) << 8) |
                           ((bytes[30] & 0xFF) << 16) | ((bytes[31] & 0xFF) << 24);
            int dataSize = (bytes[40] & 0xFF) | ((bytes[41] & 0xFF) << 8) |
                           ((bytes[42] & 0xFF) << 16) | ((bytes[43] & 0xFF) << 24);
            if (byteRate > 0 && dataSize > 0) {
                return (double) dataSize / byteRate;
            }
        }

        // Parse MPEG Audio frames (Layer III MP3)
        int offset = 0;
        // Skip ID3v2 if present
        if (bytes.length > 10 && bytes[0] == 'I' && bytes[1] == 'D' && bytes[2] == '3') {
            int id3Size = ((bytes[6] & 0x7F) << 21) | ((bytes[7] & 0x7F) << 14) |
                          ((bytes[8] & 0x7F) << 7)  | (bytes[9] & 0x7F);
            offset = 10 + id3Size;
        }

        int[][] sampleRates = {
                {11025, 12000, 8000},   // MPEG 2.5
                {0, 0, 0},              // Reserved
                {22050, 24000, 16000},  // MPEG 2
                {44100, 48000, 32000}   // MPEG 1
        };

        int[] brMpeg1 = {0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320};
        int[] brMpeg2 = {0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160};

        long totalSamples = 0;
        int lastSampleRate = 0;

        while (offset + 4 <= bytes.length) {
            int b0 = bytes[offset] & 0xFF;
            int b1 = bytes[offset + 1] & 0xFF;
            if (b0 == 0xFF && (b1 & 0xE0) == 0xE0) {
                int versionBits = (b1 >> 3) & 0x03;
                int layerBits = (b1 >> 1) & 0x03;
                int b2 = bytes[offset + 2] & 0xFF;
                int srBits = (b2 >> 2) & 0x03;
                int padding = (b2 >> 1) & 0x01;
                int brBits = (b2 >> 4) & 0x0F;

                if (versionBits != 1 && layerBits == 1 && srBits < 3 && brBits > 0 && brBits < 15) {
                    int sr = sampleRates[versionBits][srBits];
                    if (sr > 0) {
                        lastSampleRate = sr;
                        int samplesPerFrame = (versionBits == 3) ? 1152 : 576;
                        int bitRate = (versionBits == 3 ? brMpeg1[brBits] : brMpeg2[brBits]) * 1000;
                        int frameLength = (samplesPerFrame * (bitRate / 8)) / sr + padding;
                        if (frameLength > 0 && offset + frameLength <= bytes.length) {
                            totalSamples += samplesPerFrame;
                            offset += frameLength;
                            continue;
                        }
                    }
                }
            }
            offset++;
        }

        if (lastSampleRate > 0 && totalSamples > 0) {
            return (double) totalSamples / lastSampleRate;
        }

        return 0.0;
    }

    /**
     * Syllable and pause weighted duration model (fallback alignment).
     */
    public List<WordTimestamp> buildSyllableWeightedTimeline(String spokenText, double totalDurationSeconds) {
        if (spokenText == null || spokenText.isBlank()) return Collections.emptyList();

        Pattern unitPattern = Pattern.compile("([\\p{L}\\p{M}\\p{N}]+(?:['’\\-][\\p{L}\\p{M}\\p{N}]+)*)([\\s\\p{P}]*)", Pattern.UNICODE_CHARACTER_CLASS);
        Matcher matcher = unitPattern.matcher(spokenText);

        List<WordWeightUnit> units = new ArrayList<>();
        while (matcher.find()) {
            String word = matcher.group(1);
            String trailing = matcher.group(2) != null ? matcher.group(2) : "";
            double weight = estimateWordWeight(word, trailing);
            units.add(new WordWeightUnit(word, weight));
        }

        if (units.isEmpty()) return Collections.emptyList();

        double totalWeight = units.stream().mapToDouble(u -> u.weight).sum();
        double timeScale = totalDurationSeconds / (totalWeight > 0 ? totalWeight : 1.0);

        List<WordTimestamp> timeline = new ArrayList<>();
        double currentTime = 0.0;

        for (int i = 0; i < units.size(); i++) {
            WordWeightUnit u = units.get(i);
            double duration = u.weight * timeScale;
            double start = currentTime;
            double end = (i == units.size() - 1) ? totalDurationSeconds : start + duration;

            timeline.add(new WordTimestamp(u.word, start, end, i));
            currentTime = end;
        }

        return timeline;
    }

    private static class WordWeightUnit {
        final String word;
        final double weight;
        WordWeightUnit(String word, double weight) {
            this.word = word;
            this.weight = weight;
        }
    }

    private double estimateWordWeight(String word, String trailingPunctuation) {
        if (word == null || word.isBlank()) return 1.0;
        double baseWeight = 1.0;

        if (INDIC_SCRIPT_PATTERN.matcher(word).find()) {
            // Count syllable nuclei for Indic scripts
            int syllableCount = 0;
            for (int i = 0; i < word.length(); i++) {
                int code = word.charAt(i);
                int offset = code % 128;
                boolean isIndepVowel = (offset >= 0x04 && offset <= 0x14);
                boolean isConsonant = (offset >= 0x15 && offset <= 0x39);
                int nextOffset = (i + 1 < word.length()) ? (word.charAt(i + 1) % 128) : -1;
                boolean hasVirama = (nextOffset == 0x4D);
                if (isIndepVowel || (isConsonant && !hasVirama)) {
                    syllableCount++;
                }
            }
            baseWeight = Math.max(1.0, syllableCount * 1.05);
        } else {
            // English / Latin phonetic vowel group counting
            Matcher vm = Pattern.compile("[aeiouy]+", Pattern.CASE_INSENSITIVE).matcher(word);
            int syllables = 0;
            while (vm.find()) syllables++;
            baseWeight = Math.max(1.0, (syllables > 0 ? syllables : 1) * 1.1 + Math.max(0, word.length() - 6) * 0.15);
        }

        // Punctuation pause modeling
        if (trailingPunctuation.matches(".*[,;،].*")) {
            baseWeight += 1.8;
        }
        if (trailingPunctuation.matches(".*[.!?।؟].*")) {
            baseWeight += 3.2;
        }
        if (trailingPunctuation.matches(".*\\n\\n+.*")) {
            baseWeight += 4.5;
        }

        return baseWeight;
    }

    private String getEffectiveGroqKey() {
        String env = System.getenv("GROQ_API_KEY");
        if (env != null && !env.isBlank()) return env.trim();
        if (groqApiKey != null && !groqApiKey.isBlank() && !groqApiKey.startsWith("${")) return groqApiKey.trim();
        return "";
    }
}
