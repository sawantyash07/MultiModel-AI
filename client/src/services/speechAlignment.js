/**
 * Speech Alignment and Word-Level Highlighting Engine for Yash AI.
 *
 * Provides accurate, language-aware word synchronization between audio playback
 * and displayed response text across English and all 22 scheduled Indian languages
 * (Gujarati, Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Odia, Urdu, etc.).
 *
 * Capabilities:
 * 1. Exact acoustic word alignment ingestion from Whisper Large v3 forced-alignment backend.
 * 2. Syllable-weighted acoustic duration modeling for Indian (abugida) and Latin scripts fallback.
 * 3. Punctuation and sentence boundary pause modeling (commas, periods, Indic dandas, newlines).
 * 4. Exact duration scaling normalized to decoded or browser loaded HTML5 Audio duration.
 * 5. High-performance binary search for continuous real-time word lookup.
 * 6. Global chunk offset tracking for seamless auto-speak across chunk boundaries without resetting.
 * 7. Rehype AST word segmenter preserving all markdown formatting, links, and punctuation.
 */

// Stateless Unicode regex matching words across all natural language scripts
// Includes English contractions (don't, it's) and compound hyphenations, plus Indic aksharas
export const WORD_REGEX = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/u;
export const GLOBAL_WORD_REGEX = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;

// Unicode block ranges for Indic scripts
const INDIC_SCRIPT_REGEX = /[\u0900-\u0D7F\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/u;
const PERSO_ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/u;

/**
 * Tokenizes text into an array of distinct word tokens.
 */
export function tokenizeWords(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu);
  return matches || [];
}

/**
 * Estimates the phonetic and syllable weight of a word in any supported language.
 *
 * In Indian phonetics (aksharas), each consonant without virama or independent vowel
 * constitutes an acoustic syllable nucleus. In English, vowel clusters approximate syllables.
 */
export function estimateWordWeight(word, trailingPunctuation = '') {
  if (!word || !word.trim()) return 1.0;

  const clean = word.trim();
  let baseWeight = 1.0;

  if (INDIC_SCRIPT_REGEX.test(clean)) {
    // Count akshara syllable nuclei in Indic scripts:
    // Independent vowels and consonants NOT followed by virama (halant at offset 0x4D)
    let syllableCount = 0;
    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
      const offset = code % 128;
      const isIndepVowel = (offset >= 0x04 && offset <= 0x14);
      const isConsonant = (offset >= 0x15 && offset <= 0x39);
      const nextOffset = (i + 1 < clean.length) ? (clean.charCodeAt(i + 1) % 128) : -1;
      const hasVirama = (nextOffset === 0x4D);
      if (isIndepVowel || (isConsonant && !hasVirama)) {
        syllableCount++;
      }
    }
    baseWeight = Math.max(1.0, syllableCount * 1.05);
  } else if (PERSO_ARABIC_REGEX.test(clean)) {
    baseWeight = Math.max(1.0, clean.length * 0.4);
  } else {
    // English / Latin phonetic vowel group counting
    const vowelGroups = clean.match(/[aeiouy]+/gi);
    const syllables = vowelGroups ? vowelGroups.length : 1;
    // Length weighting for longer words
    baseWeight = Math.max(1.0, syllables * 1.1 + Math.max(0, clean.length - 6) * 0.15);
  }

  // Punctuation pause weighting:
  // Commas and semicolons produce ~150-250ms pauses in neural TTS models
  if (/[,;،]/.test(trailingPunctuation)) {
    baseWeight += 1.8;
  }
  // Sentence terminators (., !, ?, ।, ؟) produce ~350-500ms pauses
  if (/[.!?।؟]/.test(trailingPunctuation)) {
    baseWeight += 3.2;
  }
  // Paragraph break produces ~500-600ms pauses
  if (/\n\n+/.test(trailingPunctuation)) {
    baseWeight += 4.5;
  }

  return baseWeight;
}

/**
 * Cleans Markdown syntax (links, code blocks, bold/italics) to extract visible spoken words.
 */
export function stripMarkdownForWordCount(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, ' ')          // code blocks replaced by space
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link text](url) -> link text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')   // ![alt](url) -> empty
    .replace(/`([^`]+)`/g, '$1')              // inline code ticks
    .replace(/\*\*([^*]+)\*\*/g, '$1')        // bold **text**
    .replace(/__([^_]+)__/g, '$1')            // bold __text__
    .replace(/\*([^*]+)\*/g, '$1')            // italic *text*
    .replace(/~~([^~]+)~~/g, '$1')            // strikethrough ~~text~~
    .replace(/^#{1,6}\s+/gm, '')              // headers
    .replace(/^>\s+/gm, '')                   // blockquotes
    .replace(/^[-*+]\s+/gm, '')               // unordered lists
    .replace(/^\s*\d+\.\s+/gm, '');           // ordered lists
}

/**
 * Builds an authoritative word timing timeline.
 * If serverTimestamps (from Whisper acoustic forced-alignment) are provided, uses them directly.
 * Otherwise, synthesizes a duration-normalized syllable timeline anchored to audio duration.
 *
 * @param {string} spokenText - The speech text corresponding to the audio.
 * @param {number} totalDurationSeconds - The audio duration reported by HTML5 Audio or AudioContext.
 * @param {Array<{ word: string, start: number, end: number, index: number }>} [serverTimestamps]
 * @returns {Array<{ word: string, start: number, end: number, index: number, exact: boolean }>}
 */
export function buildWordTimeline(spokenText, totalDurationSeconds, serverTimestamps = null) {
  if (Array.isArray(serverTimestamps) && serverTimestamps.length > 0) {
    const timeline = serverTimestamps.map((item, idx) => ({
      word: item.word,
      start: typeof item.start === 'number' ? Math.max(0, item.start) : 0,
      end: typeof item.end === 'number' ? Math.max((item.start || 0) + 0.04, item.end) : 0.1,
      index: typeof item.index === 'number' ? item.index : idx,
      exact: true
    }));

    // Ensure monotonically non-decreasing start times
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i].start < timeline[i - 1].start) {
        timeline[i].start = timeline[i - 1].start;
      }
      if (timeline[i].end <= timeline[i].start) {
        timeline[i].end = timeline[i].start + 0.04;
      }
    }

    // Anchor to total duration if known
    if (typeof totalDurationSeconds === 'number' && Number.isFinite(totalDurationSeconds) && totalDurationSeconds > 0) {
      const last = timeline[timeline.length - 1];
      if (last && last.end < totalDurationSeconds) {
        last.end = totalDurationSeconds;
      }
    }

    return timeline;
  }

  if (!spokenText || typeof spokenText !== 'string' || !spokenText.trim()) {
    return [];
  }

  const cleanText = stripMarkdownForWordCount(spokenText);

  // Extract all words and their trailing separators
  const words = [];
  const regex = /([\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*)([\s\p{P}]*)/gu;
  let match;

  while ((match = regex.exec(cleanText)) !== null) {
    const word = match[1];
    const trailing = match[2] || '';
    const weight = estimateWordWeight(word, trailing);
    words.push({
      word,
      trailing,
      weight,
      rawIndex: match.index
    });
  }

  if (words.length === 0) return [];

  // Guarantee valid, finite, positive duration
  const duration = (typeof totalDurationSeconds === 'number' && Number.isFinite(totalDurationSeconds) && totalDurationSeconds > 0)
    ? totalDurationSeconds
    : Math.max(1.0, words.length * 0.38);

  const totalWeight = words.reduce((sum, w) => sum + w.weight, 0);
  const timeScale = duration / (totalWeight > 0 ? totalWeight : 1.0);

  let currentTime = 0;
  const timeline = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const wordDuration = w.weight * timeScale;
    const start = currentTime;
    const end = i === words.length - 1 ? duration : start + wordDuration;

    timeline.push({
      word: w.word,
      start,
      end,
      index: i,
      exact: false
    });

    currentTime = end;
  }

  return timeline;
}

/**
 * Finds the currently active word index on the timeline using binary search.
 * Returns relative word index on the timeline.
 *
 * @param {Array<{ word: string, start: number, end: number, index: number }>} timeline
 * @param {number} currentTimeSeconds
 * @returns {number} Active word relative index (0 to timeline.length - 1), or -1 if empty.
 */
export function findActiveWordIndex(timeline, currentTimeSeconds) {
  if (!timeline || timeline.length === 0 || currentTimeSeconds === null || currentTimeSeconds === undefined || currentTimeSeconds < 0) {
    return -1;
  }

  // If playback is at or beyond the end of the audio timeline, clear the highlight
  const last = timeline[timeline.length - 1];
  if (currentTimeSeconds >= last.end) {
    return -1;
  }

  // If playback just started before first word's start timestamp, highlight the first word
  if (currentTimeSeconds <= timeline[0].start) {
    return 0;
  }

  let low = 0;
  let high = timeline.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const item = timeline[mid];

    if (currentTimeSeconds >= item.start && currentTimeSeconds < item.end) {
      return item.index;
    } else if (currentTimeSeconds < item.start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return Math.min(timeline.length - 1, Math.max(0, high));
}

/**
 * Computes global word count for a piece of text (stripping markdown syntax for accurate speech matching).
 */
export function countWords(text) {
  if (!text || !text.trim()) return 0;
  const clean = stripMarkdownForWordCount(text);
  const words = tokenizeWords(clean);
  return words.length;
}

export {
  normalizeHighlightColor,
  rehypeHighlightApplier
} from './textAnnotationEngine.js';

/**
 * Rehype plugin to segment Markdown text nodes into sequentially indexed word spans.
 * Preserves all formatting, links, punctuation, spaces, and skips code blocks.
 */
export function rehypeWordSegmenter() {
  return (tree) => {
    let wordIndex = 0;

    function walk(node, parent) {
      if (!node) return;

      // Never segment preformatted code blocks
      if (node.type === 'element' && (node.tagName === 'pre' || (node.tagName === 'code' && parent?.tagName === 'pre'))) {
        return;
      }

      if (node.type === 'text' && typeof node.value === 'string' && parent?.tagName !== 'pre') {
        const text = node.value;
        const tokens = text.split(/([\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*)/u);
        if (tokens.length <= 1 && !WORD_REGEX.test(text)) {
          return;
        }

        const newChildren = [];
        for (const token of tokens) {
          if (!token) continue;
          if (WORD_REGEX.test(token)) {
            newChildren.push({
              type: 'element',
              tagName: 'span',
              properties: {
                className: ['tts-word'],
                'data-word-index': String(wordIndex++)
              },
              children: [{ type: 'text', value: token }]
            });
          } else {
            newChildren.push({ type: 'text', value: token });
          }
        }

        if (parent && parent.children) {
          const idx = parent.children.indexOf(node);
          if (idx !== -1) {
            parent.children.splice(idx, 1, ...newChildren);
          }
        }
        return;
      }

      if (node.children && Array.isArray(node.children)) {
        const children = [...node.children];
        for (const child of children) {
          walk(child, node);
        }
      }
    }

    walk(tree, null);
  };
}

/**
 * Safely decodes audio blob via AudioContext to determine exact physical playback duration.
 */
export async function getExactAudioDuration(blob, fallbackDurationMs = 0) {
  try {
    const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (AudioContextClass && blob) {
      const ctx = new AudioContextClass();
      const arrayBuffer = await blob.slice(0).arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const dur = audioBuffer.duration;
      try { ctx.close(); } catch (_) {}
      if (Number.isFinite(dur) && dur > 0) {
        return dur;
      }
    }
  } catch (_) {}

  // Fallback to validated duration in milliseconds from backend
  if (typeof fallbackDurationMs === 'number' && fallbackDurationMs > 0) {
    return fallbackDurationMs / 1000;
  }

  return null;
}
