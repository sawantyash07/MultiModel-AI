package com.coderarmy.ragsupport.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SpeechAlignmentServiceTest {

    private SpeechAlignmentService service;

    @BeforeEach
    void setUp() {
        service = new SpeechAlignmentService();
    }

    @Test
    void testExtractWordsMultilingual() {
        // English
        List<String> enWords = service.extractWords("Hello, world! How are you?");
        assertEquals(List.of("Hello", "world", "How", "are", "you"), enWords);

        // Hindi
        List<String> hiWords = service.extractWords("नमस्ते! आप कैसे हैं?");
        assertEquals(List.of("नमस्ते", "आप", "कैसे", "हैं"), hiWords);

        // Gujarati
        List<String> guWords = service.extractWords("નમસ્તે, તમે કેમ છો?");
        assertEquals(List.of("નમસ્તે", "તમે", "કેમ", "છો"), guWords);

        // Marathi
        List<String> mrWords = service.extractWords("नमस्कार, तुम्ही कसे आहात?");
        assertEquals(List.of("नमस्कार", "तुम्ही", "कसे", "आहात"), mrWords);
    }

    @Test
    void testMonotonicSequenceAlignmentExactMatch() {
        List<String> refWords = List.of("Hello", "world", "how", "are", "you");
        List<SpeechAlignmentService.WordTimestamp> whisperWords = List.of(
                new SpeechAlignmentService.WordTimestamp("Hello", 0.1, 0.4, 0),
                new SpeechAlignmentService.WordTimestamp("world,", 0.4, 0.9, 1),
                new SpeechAlignmentService.WordTimestamp("how", 0.9, 1.2, 2),
                new SpeechAlignmentService.WordTimestamp("are", 1.2, 1.5, 3),
                new SpeechAlignmentService.WordTimestamp("you?", 1.5, 2.0, 4)
        );

        List<SpeechAlignmentService.WordTimestamp> aligned = service.monotonicSequenceAlignment(refWords, whisperWords, 2.0);

        assertEquals(5, aligned.size());
        assertEquals("Hello", aligned.get(0).getWord());
        assertEquals(0.1, aligned.get(0).getStart(), 0.01);
        assertEquals(0.4, aligned.get(0).getEnd(), 0.01);

        assertEquals("world", aligned.get(1).getWord());
        assertEquals(0.4, aligned.get(1).getStart(), 0.01);
        assertEquals(0.9, aligned.get(1).getEnd(), 0.01);

        assertEquals("you", aligned.get(4).getWord());
        assertEquals(2.0, aligned.get(4).getEnd(), 0.01);

        // Verify strictly monotonic ordering
        for (int i = 1; i < aligned.size(); i++) {
            assertTrue(aligned.get(i).getStart() >= aligned.get(i - 1).getStart(),
                    "Start times must be monotonic: " + aligned.get(i - 1) + " -> " + aligned.get(i));
            assertTrue(aligned.get(i).getEnd() > aligned.get(i).getStart(),
                    "End time must exceed start time: " + aligned.get(i));
        }
    }

    @Test
    void testMonotonicSequenceAlignmentWithOmittedWord() {
        // Reference has "is", but acoustic transcription omitted it
        List<String> refWords = List.of("Artificial", "intelligence", "is", "great");
        List<SpeechAlignmentService.WordTimestamp> whisperWords = List.of(
                new SpeechAlignmentService.WordTimestamp("Artificial", 0.0, 0.8, 0),
                new SpeechAlignmentService.WordTimestamp("intelligence", 0.8, 1.5, 1),
                new SpeechAlignmentService.WordTimestamp("great.", 1.8, 2.5, 2)
        );

        List<SpeechAlignmentService.WordTimestamp> aligned = service.monotonicSequenceAlignment(refWords, whisperWords, 2.5);

        assertEquals(4, aligned.size());
        assertEquals("Artificial", aligned.get(0).getWord());
        assertEquals("intelligence", aligned.get(1).getWord());
        assertEquals("is", aligned.get(2).getWord());
        assertEquals("great", aligned.get(3).getWord());

        // "is" should be interpolated between 1.5s and 1.8s
        assertTrue(aligned.get(2).getStart() >= 1.5);
        assertTrue(aligned.get(2).getEnd() <= 1.8);

        // Monotonic check
        for (int i = 1; i < aligned.size(); i++) {
            assertTrue(aligned.get(i).getStart() >= aligned.get(i - 1).getStart());
            assertTrue(aligned.get(i).getEnd() > aligned.get(i).getStart());
        }
    }

    @Test
    void testBuildSyllableWeightedTimeline() {
        String text = "Hello world! This is a test sentence.";
        double duration = 3.5;
        List<SpeechAlignmentService.WordTimestamp> timeline = service.buildSyllableWeightedTimeline(text, duration);

        assertNotNull(timeline);
        assertEquals(7, timeline.size());
        assertEquals(0.0, timeline.get(0).getStart(), 0.001);
        assertEquals(3.5, timeline.get(timeline.size() - 1).getEnd(), 0.001);

        for (int i = 1; i < timeline.size(); i++) {
            assertTrue(timeline.get(i).getStart() >= timeline.get(i - 1).getStart());
            assertTrue(timeline.get(i).getEnd() > timeline.get(i).getStart());
        }
    }

    @Test
    void testEmptyAndNullHandling() {
        assertTrue(service.extractWords(null).isEmpty());
        assertTrue(service.extractWords("").isEmpty());
        assertTrue(service.extractWords("   ").isEmpty());

        assertEquals(0.0, service.calculateAudioDurationSeconds(null));
        assertEquals(0.0, service.calculateAudioDurationSeconds(new byte[0]));

        assertTrue(service.buildSyllableWeightedTimeline(null, 1.0).isEmpty());
        assertTrue(service.buildSyllableWeightedTimeline("", 1.0).isEmpty());

        SpeechAlignmentService.AlignmentResult res = service.alignSpeech(null, null, "en");
        assertTrue(res.getTimestamps().isEmpty());
        assertFalse(res.isExact());
    }
}
