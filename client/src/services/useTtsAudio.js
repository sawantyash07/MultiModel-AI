import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from './api.js';
import {
  SCHEDULED_LANGUAGES,
  TTS_LANGUAGES,
  findLanguageByCode,
  searchLanguages,
  isMatchingScript,
  getVoicesForLanguage,
  isProductionLanguage
} from './languageRegistry.js';
import {
  buildWordTimeline,
  findActiveWordIndex,
  countWords,
  tokenizeWords,
  WORD_REGEX,
  GLOBAL_WORD_REGEX,
  rehypeWordSegmenter,
  rehypeHighlightApplier,
  normalizeHighlightColor,
  getExactAudioDuration
} from './speechAlignment.js';

export {
  SCHEDULED_LANGUAGES,
  TTS_LANGUAGES,
  findLanguageByCode,
  searchLanguages,
  isMatchingScript,
  getVoicesForLanguage,
  isProductionLanguage,
  buildWordTimeline,
  findActiveWordIndex,
  countWords,
  tokenizeWords,
  WORD_REGEX,
  GLOBAL_WORD_REGEX,
  rehypeWordSegmenter,
  rehypeHighlightApplier,
  normalizeHighlightColor,
  getExactAudioDuration
};

export const TTS_SPEED_OPTIONS = [
  { value: 0.5, label: '0.5×', desc: 'Slow' },
  { value: 1.0, label: '1×', desc: 'Normal' },
  { value: 1.5, label: '1.5×', desc: 'Fast' },
  { value: 2.0, label: '2×', desc: 'Very fast' }
];

/**
 * Intelligent text chunker for continuous speech synthesis.
 * Segments streaming text into natural, balanced speech chunks.
 * Handles English and all Indic punctuation marks (। . ! ? \n\n).
 */
export function extractSpeechChunks(text, isDone = false, minFirstChunk = 65, minNextChunk = 170, maxChunkLength = 260) {
  if (!text || !text.trim()) return { chunks: [], leftover: '' };

  const boundaryRegex = /([^.!?।\n]+[.!?।]+|\n\n+)(?:\s+|$)/g;
  const units = [];
  let lastIndex = 0;
  let match;

  while ((match = boundaryRegex.exec(text)) !== null) {
    const raw = match[1].trim();
    if (raw.length > 0) units.push(raw);
    lastIndex = boundaryRegex.lastIndex;
  }

  let leftover = text.slice(lastIndex).trim();
  const chunks = [];
  let currentBuffer = '';

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!currentBuffer) {
      currentBuffer = u;
    } else {
      currentBuffer += ' ' + u;
    }

    const targetMin = (chunks.length === 0) ? minFirstChunk : minNextChunk;
    if (currentBuffer.length >= targetMin) {
      chunks.push(currentBuffer.trim());
      currentBuffer = '';
    }
  }

  // If stream is done, combine buffer and leftover into the final chunk
  if (isDone) {
    let finalPart = (currentBuffer ? currentBuffer + ' ' : '') + leftover;
    finalPart = finalPart.trim();
    if (finalPart.length > 0) {
      chunks.push(finalPart);
    }
    return { chunks, leftover: '' };
  }

  // If pending buffer without punctuation grows past maxChunkLength, split on last word boundary
  let combinedPending = (currentBuffer ? currentBuffer + ' ' : '') + leftover;
  if (combinedPending.length >= maxChunkLength) {
    const lastSpace = combinedPending.lastIndexOf(' ', maxChunkLength);
    if (lastSpace > minFirstChunk) {
      chunks.push(combinedPending.slice(0, lastSpace).trim());
      leftover = combinedPending.slice(lastSpace).trim();
      currentBuffer = '';
    }
  }

  return { chunks, leftover: (currentBuffer ? currentBuffer + ' ' : '') + leftover };
}

// Backward-compatible export
export function extractSentencesFromText(text, isDone = false) {
  const result = extractSpeechChunks(text, isDone);
  return { sentences: result.chunks, leftover: result.leftover };
}

export function useTtsAudio() {
  const [selectedLanguage, setSelectedLanguageState] = useState(() => {
    return localStorage.getItem('yash_ai_tts_lang') || 'en';
  });

  const [selectedVoice, setSelectedVoiceState] = useState(() => {
    const lang = localStorage.getItem('yash_ai_tts_lang') || 'en';
    const savedVoice = localStorage.getItem(`yash_ai_tts_voice_${lang}`);
    const voices = getVoicesForLanguage(lang);
    if (savedVoice && voices.some(v => v.id === savedVoice)) {
      return savedVoice;
    }
    const def = voices.find(v => v.isDefault);
    return def ? def.id : (voices[0]?.id || 'shubh');
  });
  const selectedVoiceRef = useRef(selectedVoice);
  selectedVoiceRef.current = selectedVoice;

  const [playbackSpeed, setPlaybackSpeedState] = useState(() => {
    const saved = localStorage.getItem('yash_ai_tts_speed');
    const num = parseFloat(saved);
    return [0.5, 1.0, 1.5, 2.0].includes(num) ? num : 1.0;
  });
  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  const [autoPlaySpeech, setAutoPlaySpeechState] = useState(() => {
    return localStorage.getItem('yash_ai_tts_autoplay') === 'true';
  });

  /**
   * Finite State Machine for Speech Playback:
   * 'idle' -> 'loading' -> 'playing' -> 'paused' -> 'completed' -> 'idle'
   * Or 'error' on explicit failure.
   */
  const [ttsState, setTtsState] = useState({
    activeMessageId: null,
    conversationId: null,
    status: 'idle', // 'idle' | 'loading' | 'playing' | 'paused' | 'completed' | 'error'
    error: null,
    activeLang: 'en',
    activeVoice: selectedVoice,
    playbackSpeed,
    spokenText: null,
    isAutoSpeak: false,
    currentChunkIndex: 0,
    totalChunks: 0,
    loadingDescription: null,
    activeWordIndex: -1
  });

  const ttsStateRef = useRef(ttsState);
  useEffect(() => {
    ttsStateRef.current = ttsState;
  }, [ttsState]);

  const audioRef = useRef(null);
  const cacheRef = useRef({}); // { `${msgId}_${lang}_${voice}_${speed}`: { url, spokenText, duration } }
  const inFlightRef = useRef(null); // active manual in-flight request key
  const streamSessionRef = useRef(null); // active streaming auto-speak session
  const activePlaybackSessionIdRef = useRef(0); // tracks monotonic generation ID to reject stale responses

  // Synchronized text highlighting refs
  const timelineRef = useRef([]); // [{ word, start, end, index }]
  const currentGlobalOffsetRef = useRef(0);
  const lastDispatchedWordIndexRef = useRef(-1);
  const currentSpokenTextRef = useRef('');
  const rafIdRef = useRef(null);

  // State guards to prevent HTML5 Audio error dispatch when resetting/stopping
  const isStoppingRef = useRef(false);
  const isCompletedRef = useRef(false);

  // Dynamic voice speed controller
  const setPlaybackSpeed = useCallback((speed) => {
    const num = Number(speed);
    if (isNaN(num)) return;
    playbackSpeedRef.current = num;
    setPlaybackSpeedState(num);
    localStorage.setItem('yash_ai_tts_speed', String(num));

    if (audioRef.current) {
      try {
        audioRef.current.playbackRate = num;
        audioRef.current.defaultPlaybackRate = num;
      } catch (err) {
        console.warn('[useTtsAudio] Dynamic playbackRate update error:', err);
      }
    }

    setTtsState(prev => ({
      ...prev,
      playbackSpeed: num
    }));
  }, []);

  // Active word highlight synchronizer functions
  const stopSyncLoop = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const updateActiveWordHighlight = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.ended) {
      if (lastDispatchedWordIndexRef.current !== -1) {
        lastDispatchedWordIndexRef.current = -1;
        setTtsState(prev => prev.activeWordIndex === -1 ? prev : { ...prev, activeWordIndex: -1 });
      }
      return;
    }

    const timeline = timelineRef.current;
    if (!timeline || timeline.length === 0) return;

    const currentTime = audio.currentTime;
    if (!Number.isFinite(currentTime)) return;

    const relativeIndex = findActiveWordIndex(timeline, currentTime);
    if (relativeIndex < 0) {
      if (currentTime >= timeline[timeline.length - 1].end) {
        if (lastDispatchedWordIndexRef.current !== -1) {
          lastDispatchedWordIndexRef.current = -1;
          setTtsState(prev => prev.activeWordIndex === -1 ? prev : { ...prev, activeWordIndex: -1 });
        }
      }
      return;
    }

    const globalIndex = currentGlobalOffsetRef.current + relativeIndex;

    if (globalIndex !== lastDispatchedWordIndexRef.current) {
      lastDispatchedWordIndexRef.current = globalIndex;
      const wordObj = timeline[relativeIndex];

      // Diagnostics required for synchronization verification
      if (typeof window !== 'undefined') {
        window.__TTS_DEBUG_INFO__ = {
          audioGenerationId: activePlaybackSessionIdRef.current,
          audioSource: audio.src,
          currentTime,
          activeWordIndex: globalIndex,
          activeWordText: wordObj?.word,
          start: wordObj?.start,
          end: wordObj?.end,
          playbackSpeed: playbackSpeedRef.current,
          alignmentSource: wordObj?.exact ? 'whisper_exact' : 'duration_scaled',
          isPaused: audio.paused,
          duration: audio.duration,
          messageId: ttsStateRef.current?.activeMessageId
        };
      }
      console.log(`[TTS Active Word] genId=${activePlaybackSessionIdRef.current}, time=${currentTime.toFixed(2)}s, idx=${globalIndex}, word="${wordObj?.word}", range=[${wordObj?.start.toFixed(2)}s, ${wordObj?.end.toFixed(2)}s], speed=${playbackSpeedRef.current}x, paused=${audio.paused}`);

      setTtsState(prev => {
        if (prev.activeWordIndex === globalIndex) return prev;
        return { ...prev, activeWordIndex: globalIndex };
      });
    }
  }, []);

  const seek = useCallback((timeSeconds) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(timeSeconds)) return;
    const dur = audio.duration;
    const target = Math.max(0, Number.isFinite(dur) && dur > 0 ? Math.min(timeSeconds, dur) : timeSeconds);
    audio.currentTime = target;
    updateActiveWordHighlight();
  }, [updateActiveWordHighlight]);

  const seekToWord = useCallback((globalWordIndex) => {
    const timeline = timelineRef.current;
    const offset = currentGlobalOffsetRef.current;
    const relativeIndex = globalWordIndex - offset;
    if (timeline && relativeIndex >= 0 && relativeIndex < timeline.length) {
      const item = timeline[relativeIndex];
      if (item && Number.isFinite(item.start)) {
        seek(item.start);
      }
    }
  }, [seek]);

  const startSyncLoop = useCallback(() => {
    stopSyncLoop();
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (!audio.paused && !audio.ended) {
        updateActiveWordHighlight();
      }

      // Continue polling while audio has a valid source and is active and playing
      if (!audio.paused && !audio.ended && audio.src && audio.src !== '') {
        rafIdRef.current = requestAnimationFrame(tick);
      }
    };
    rafIdRef.current = requestAnimationFrame(tick);
  }, [stopSyncLoop, updateActiveWordHighlight]);

  // Stop all audio playback, release session object URLs, and abort in-flight synthesis
  const stop = useCallback(() => {
    isStoppingRef.current = true;
    activePlaybackSessionIdRef.current++; // Invalidate any in-flight synthesis responses immediately
    stopSyncLoop();
    lastDispatchedWordIndexRef.current = -1;
    timelineRef.current = [];
    currentGlobalOffsetRef.current = 0;
    currentSpokenTextRef.current = '';

    // 1. Cancel active streaming session if any
    if (streamSessionRef.current) {
      const session = streamSessionRef.current;
      session.cancelled = true;
      if (session.abortController) {
        try { session.abortController.abort(); } catch (_) {}
      }
      if (session.chunks) {
        session.chunks.forEach(c => {
          if (c.audioUrl) {
            try { URL.revokeObjectURL(c.audioUrl); } catch (_) {}
          }
        });
      }
      streamSessionRef.current = null;
    }

    // 2. Clear manual in-flight key
    inFlightRef.current = null;

    // 3. Stop HTML audio element cleanly without triggering error events
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.removeAttribute('src');
      } catch (_) {}
    }

    // 4. Reset state to idle, clearing any error or loading state
    setTtsState(prev => ({
      ...prev,
      activeMessageId: null,
      conversationId: null,
      status: 'idle',
      error: null,
      activeLang: selectedLanguage,
      spokenText: null,
      isAutoSpeak: false,
      currentChunkIndex: 0,
      totalChunks: 0,
      loadingDescription: null,
      activeWordIndex: -1
    }));

    setTimeout(() => {
      isStoppingRef.current = false;
    }, 60);
  }, [selectedLanguage, stopSyncLoop]);

  // Set selected language and persist; stops any currently active speech from prior language cleanly
  const setSelectedLanguage = useCallback((lang) => {
    stop();
    setSelectedLanguageState(lang);
    localStorage.setItem('yash_ai_tts_lang', lang);

    // Determine default or saved voice for the newly selected language
    const savedVoice = localStorage.getItem(`yash_ai_tts_voice_${lang}`);
    const voices = getVoicesForLanguage(lang);
    let voiceToSet = savedVoice;
    if (!voiceToSet || !voices.some(v => v.id === voiceToSet)) {
      const def = voices.find(v => v.isDefault);
      voiceToSet = def ? def.id : (voices[0]?.id || 'shubh');
    }
    selectedVoiceRef.current = voiceToSet;
    setSelectedVoiceState(voiceToSet);

    setTtsState(prev => ({
      ...prev,
      activeLang: lang,
      activeVoice: voiceToSet
    }));
  }, [stop]);

  // Set selected voice persona for current language
  const setSelectedVoice = useCallback((voiceId) => {
    if (!voiceId) return;
    stop();
    selectedVoiceRef.current = voiceId;
    setSelectedVoiceState(voiceId);
    localStorage.setItem(`yash_ai_tts_voice_${selectedLanguage}`, voiceId);
    setTtsState(prev => ({
      ...prev,
      activeVoice: voiceId
    }));
  }, [stop, selectedLanguage]);

  // Set Auto Speak toggle and persist; if turned OFF, immediately stop speech and cancel queue
  const setAutoPlaySpeech = useCallback((enabled) => {
    const val = typeof enabled === 'function' ? enabled(autoPlaySpeech) : enabled;
    setAutoPlaySpeechState(val);
    localStorage.setItem('yash_ai_tts_autoplay', String(val));

    if (!val) {
      stop();
    }
  }, [autoPlaySpeech, stop]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused && audioRef.current.src) {
      try {
        audioRef.current.playbackRate = playbackSpeedRef.current;
        audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
      } catch (_) {}
      audioRef.current.play().catch(err => {
        console.warn('[useTtsAudio] Resume error:', err);
      });
    }
  }, []);

  // Process next items in the active streaming auto-speak session (controlled prefetch queue)
  const processStreamingQueue = useCallback(async () => {
    const session = streamSessionRef.current;
    if (!session || session.cancelled) return;

    // Concurrency control: only 1 in-flight synthesis request at a time
    const isSynthesizing = session.chunks.some(c => c.status === 'synthesizing');
    if (isSynthesizing) return;

    // Find the next pending chunk to synthesize
    const nextPending = session.chunks.find(c => c.status === 'pending');
    if (!nextPending) return;

    nextPending.status = 'synthesizing';

    // If nothing is playing yet, indicate subtle loading in toolbar
    if (session.currentPlayingIndex === -1) {
      setTtsState(prev => ({
        ...prev,
        activeMessageId: session.messageId,
        conversationId: session.conversationId,
        status: 'loading',
        error: null,
        activeLang: session.targetLang,
        isAutoSpeak: true,
        currentChunkIndex: nextPending.index,
        totalChunks: session.chunks.length,
        loadingDescription: null
      }));
    }

    // Fire synthesis asynchronously in background
    (async () => {
      try {
        const res = await api.synthesizeSpeech({
          text: nextPending.text,
          language: session.targetLang,
          voice: session.targetVoice || selectedVoiceRef.current,
          conversationId: session.conversationId,
          messageId: `${session.messageId}_c${nextPending.index}`,
          signal: session.abortController.signal
        });

        if (session.cancelled) return;

        const audioUrl = URL.createObjectURL(res.audioBlob);
        const exactDuration = await getExactAudioDuration(res.audioBlob, res.durationMs);
        nextPending.audioUrl = audioUrl;
        nextPending.spokenText = res.spokenText;
        nextPending.duration = exactDuration;
        nextPending.timestamps = res.timestamps;
        nextPending.status = 'ready';

        // Case A: Nothing is playing yet (start Chunk 0 immediately!)
        if (session.currentPlayingIndex === -1 && audioRef.current) {
          session.currentPlayingIndex = nextPending.index;
          session.waitingForIndex = null;
          nextPending.status = 'playing';

          let offset = typeof nextPending.wordOffset === 'number' ? nextPending.wordOffset : 0;
          if (offset === 0 && nextPending.index > 0) {
            for (let i = 0; i < nextPending.index; i++) {
              const c = session.chunks[i];
              if (c?.text) offset += countWords(c.text);
            }
          }
          currentGlobalOffsetRef.current = offset;
          const spoken = res.spokenText || nextPending.text;
          currentSpokenTextRef.current = spoken;
          lastDispatchedWordIndexRef.current = -1;
          timelineRef.current = buildWordTimeline(spoken, exactDuration || (countWords(spoken) * 0.38), res.timestamps);

          setTtsState({
            activeMessageId: session.messageId,
            conversationId: session.conversationId,
            status: 'playing',
            error: null,
            activeLang: session.targetLang,
            spokenText: res.spokenText,
            isAutoSpeak: true,
            currentChunkIndex: nextPending.index,
            totalChunks: session.chunks.length,
            loadingDescription: null,
            activeWordIndex: offset
          });

          audioRef.current.src = audioUrl;
          try {
            audioRef.current.playbackRate = playbackSpeedRef.current;
            audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
          } catch (_) {}
          await audioRef.current.play();
        }
        // Case B: Audio was waiting for this specific chunk to finish synthesizing
        else if (session.waitingForIndex === nextPending.index && audioRef.current) {
          session.waitingForIndex = null;
          session.currentPlayingIndex = nextPending.index;
          nextPending.status = 'playing';

          let offset = typeof nextPending.wordOffset === 'number' ? nextPending.wordOffset : 0;
          if (offset === 0 && nextPending.index > 0) {
            for (let i = 0; i < nextPending.index; i++) {
              const c = session.chunks[i];
              if (c?.text) offset += countWords(c.text);
            }
          }
          currentGlobalOffsetRef.current = offset;
          const spoken = res.spokenText || nextPending.text;
          currentSpokenTextRef.current = spoken;
          lastDispatchedWordIndexRef.current = -1;
          timelineRef.current = buildWordTimeline(spoken, exactDuration || (countWords(spoken) * 0.38), res.timestamps);

          setTtsState({
            activeMessageId: session.messageId,
            conversationId: session.conversationId,
            status: 'playing',
            error: null,
            activeLang: session.targetLang,
            spokenText: res.spokenText,
            isAutoSpeak: true,
            currentChunkIndex: nextPending.index,
            totalChunks: session.chunks.length,
            loadingDescription: null,
            activeWordIndex: offset
          });

          audioRef.current.src = audioUrl;
          try {
            audioRef.current.playbackRate = playbackSpeedRef.current;
            audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
          } catch (_) {}
          await audioRef.current.play();
        }

        // Pipelining: Trigger prefetching of the next pending chunk while current chunk plays
        processStreamingQueue();
      } catch (err) {
        if (err.name === 'AbortError' || session.cancelled) return;
        console.error('[useTtsAudio] Auto-speak chunk synthesis failed:', err);
        nextPending.status = 'error';
        nextPending.error = err.message;

        if (session.currentPlayingIndex === -1 || session.waitingForIndex === nextPending.index) {
          setTtsState(prev => ({
            ...prev,
            status: 'error',
            error: err.message || 'Speech generation failed'
          }));
        }
      }
    })();
  }, []);

  // Initialize Audio element listeners once
  useEffect(() => {
    const audio = new Audio();
    try {
      audio.playbackRate = playbackSpeedRef.current;
      audio.defaultPlaybackRate = playbackSpeedRef.current;
    } catch (_) {}
    audioRef.current = audio;

    const handlePlay = () => {
      try {
        if (audioRef.current) {
          audioRef.current.playbackRate = playbackSpeedRef.current;
        }
      } catch (_) {}
      startSyncLoop();
      setTtsState(prev => {
        if (prev.status !== 'playing') {
          return { ...prev, status: 'playing', error: null };
        }
        return prev;
      });
    };

    const handlePause = () => {
      stopSyncLoop();
      setTtsState(prev => {
        if (prev.status === 'playing') {
          return { ...prev, status: 'paused' };
        }
        return prev;
      });
    };

    const handleTimeUpdate = () => {
      updateActiveWordHighlight();
    };

    const handleLoadedMetadata = () => {
      // Preserve existing acoustic Whisper timestamps. Only generate fallback if timeline is empty.
      if (!timelineRef.current || timelineRef.current.length === 0) {
        if (Number.isFinite(audio.duration) && audio.duration > 0 && currentSpokenTextRef.current) {
          timelineRef.current = buildWordTimeline(currentSpokenTextRef.current, audio.duration);
        }
      } else if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const last = timelineRef.current[timelineRef.current.length - 1];
        if (last && last.end < audio.duration) {
          last.end = audio.duration;
        }
      }
      updateActiveWordHighlight();
    };

    const handlePlaying = () => {
      startSyncLoop();
    };

    const handleSeeking = () => {
      updateActiveWordHighlight();
    };

    const handleSeeked = () => {
      updateActiveWordHighlight();
      startSyncLoop();
    };

    const handleEnded = () => {
      const session = streamSessionRef.current;

      // Advance through streaming auto-speak queue if active
      if (session && !session.cancelled && session.isAutoSpeak) {
        const finishedIndex = session.currentPlayingIndex;
        if (finishedIndex >= 0 && finishedIndex < session.chunks.length) {
          session.chunks[finishedIndex].status = 'played';
        }

        const nextIndex = finishedIndex + 1;
        const nextChunk = session.chunks[nextIndex];

        if (nextChunk) {
          if (nextChunk.status === 'ready' && nextChunk.audioUrl) {
            session.currentPlayingIndex = nextIndex;
            session.waitingForIndex = null;
            nextChunk.status = 'playing';

            let offset = typeof nextChunk.wordOffset === 'number' ? nextChunk.wordOffset : 0;
            if (offset === 0 && nextIndex > 0) {
              for (let i = 0; i < nextIndex; i++) {
                const c = session.chunks[i];
                if (c?.text) offset += countWords(c.text);
              }
            }
            currentGlobalOffsetRef.current = offset;
            const spoken = nextChunk.spokenText || nextChunk.text;
            currentSpokenTextRef.current = spoken;
            lastDispatchedWordIndexRef.current = -1;
            timelineRef.current = buildWordTimeline(spoken, nextChunk.duration || (countWords(spoken) * 0.38), nextChunk.timestamps);

            setTtsState({
              activeMessageId: session.messageId,
              conversationId: session.conversationId,
              status: 'playing',
              error: null,
              activeLang: session.targetLang,
              spokenText: nextChunk.spokenText,
              isAutoSpeak: true,
              currentChunkIndex: nextIndex,
              totalChunks: session.chunks.length,
              loadingDescription: null,
              activeWordIndex: offset
            });

            audio.src = nextChunk.audioUrl;
            try {
              audio.playbackRate = playbackSpeedRef.current;
              audio.defaultPlaybackRate = playbackSpeedRef.current;
            } catch (_) {}
            audio.play().catch(err => console.warn('[useTtsAudio] Next chunk play failed:', err));

            processStreamingQueue();
            return;
          } else if (nextChunk.status === 'synthesizing' || nextChunk.status === 'pending') {
            session.waitingForIndex = nextIndex;
            session.currentPlayingIndex = -1;

            setTtsState(prev => ({
              ...prev,
              status: 'loading',
              error: null,
              currentChunkIndex: nextIndex,
              loadingDescription: null
            }));
            processStreamingQueue();
            return;
          }
        } else if (session.isStreamDone) {
          // All chunks played and LLM stream is finished
          stopSyncLoop();
          lastDispatchedWordIndexRef.current = -1;
          timelineRef.current = [];
          currentGlobalOffsetRef.current = 0;
          currentSpokenTextRef.current = '';

          if (session.chunks) {
            session.chunks.forEach(c => {
              if (c.audioUrl) {
                try { URL.revokeObjectURL(c.audioUrl); } catch (_) {}
              }
            });
          }
          streamSessionRef.current = null;
          isCompletedRef.current = true;

          // Transition: completed -> idle, clear error completely, reset control to Start / speaker icon
          setTtsState({
            activeMessageId: null,
            conversationId: null,
            status: 'idle',
            error: null,
            activeLang: selectedLanguage,
            spokenText: null,
            isAutoSpeak: false,
            currentChunkIndex: 0,
            totalChunks: 0,
            loadingDescription: null,
            activeWordIndex: -1
          });

          setTimeout(() => { isCompletedRef.current = false; }, 80);
          return;
        } else {
          // LLM is still streaming, wait for next chunk
          session.waitingForIndex = nextIndex;
          session.currentPlayingIndex = -1;
          setTtsState(prev => ({
            ...prev,
            status: 'loading',
            error: null,
            currentChunkIndex: nextIndex,
            loadingDescription: null
          }));
          return;
        }
      }

      // Manual single-message playback ended successfully!
      stopSyncLoop();
      lastDispatchedWordIndexRef.current = -1;
      timelineRef.current = [];
      currentGlobalOffsetRef.current = 0;
      currentSpokenTextRef.current = '';
      isCompletedRef.current = true;
      setTtsState(prev => ({
        ...prev,
        status: 'idle',
        activeMessageId: null,
        error: null, // Clear error! Completed playback must NEVER show Retry!
        loadingDescription: null,
        activeWordIndex: -1
      }));

      setTimeout(() => { isCompletedRef.current = false; }, 80);
    };

    const handleError = (e) => {
      // Guard: Ignore browser audio errors if intentionally stopping, completed, or if src is empty
      if (isStoppingRef.current || isCompletedRef.current) return;
      if (!audio.src || audio.src === '' || audio.src === window.location.href) return;

      console.warn('[useTtsAudio] Audio element playback error:', e);
      setTtsState(prev => {
        // Only set error state if currently active in loading or playing
        if (prev.status !== 'playing' && prev.status !== 'loading') {
          return prev;
        }
        return {
          ...prev,
          status: 'error',
          error: 'Playback error occurred on audio stream.',
          activeWordIndex: -1
        };
      });
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('seeking', handleSeeking);
    audio.addEventListener('seeked', handleSeeked);

    return () => {
      stopSyncLoop();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('seeking', handleSeeking);
      audio.removeEventListener('seeked', handleSeeked);
      audio.pause();
      try { audio.removeAttribute('src'); } catch (_) {}

      // Revoke all cached object URLs to prevent memory leaks
      Object.values(cacheRef.current).forEach(item => {
        if (item?.url) {
          try { URL.revokeObjectURL(item.url); } catch (_) {}
        }
      });
      cacheRef.current = {};
    };
  }, [processStreamingQueue, selectedLanguage, startSyncLoop, stopSyncLoop, updateActiveWordHighlight]);

  // Feed streamed text chunks incrementally for continuous Auto Speak pipelining
  const feedStreamingText = useCallback((messageId, fullText, conversationId, langOverride = null, voiceOverride = null) => {
    if (!autoPlaySpeech || !fullText || !messageId) return;

    const targetLang = langOverride || selectedLanguage;
    const targetVoice = voiceOverride || selectedVoiceRef.current;

    if (!streamSessionRef.current || streamSessionRef.current.messageId !== messageId) {
      if (streamSessionRef.current?.abortController) {
        try { streamSessionRef.current.abortController.abort(); } catch (_) {}
      }

      streamSessionRef.current = {
        messageId,
        conversationId,
        targetLang,
        targetVoice,
        chunks: [],
        committedChunksCount: 0,
        currentPlayingIndex: -1,
        waitingForIndex: null,
        isStreamDone: false,
        isAutoSpeak: true,
        cancelled: false,
        abortController: new AbortController()
      };
    }

    const session = streamSessionRef.current;
    if (session.cancelled) return;

    const { chunks } = extractSpeechChunks(fullText, false);

    if (chunks.length > session.committedChunksCount) {
      let charSearchIndex = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i]?.trim();
        if (!chunkText) continue;

        const foundCharIdx = fullText.indexOf(chunkText, charSearchIndex);
        const charStart = foundCharIdx !== -1 ? foundCharIdx : charSearchIndex;
        charSearchIndex = charStart + chunkText.length;

        if (i >= session.committedChunksCount) {
          const preText = fullText.slice(0, charStart);
          const wordOffset = countWords(preText);

          session.chunks.push({
            index: session.chunks.length,
            text: chunkText,
            wordOffset,
            audioUrl: null,
            spokenText: null,
            status: 'pending',
            error: null
          });
        }
      }
      session.committedChunksCount = chunks.length;
      processStreamingQueue();
    }
  }, [autoPlaySpeech, selectedLanguage, processStreamingQueue]);

  // Finish streaming session when LLM generation completes, flushing remaining text
  const finishStreamingSpeech = useCallback((messageId, fullText, conversationId, langOverride = null, voiceOverride = null) => {
    if (!autoPlaySpeech || !fullText || !messageId) return;

    const targetLang = langOverride || selectedLanguage;
    const targetVoice = voiceOverride || selectedVoiceRef.current;
    let session = streamSessionRef.current;

    if (!session || session.messageId !== messageId) {
      session = {
        messageId,
        conversationId,
        targetLang,
        targetVoice,
        chunks: [],
        committedChunksCount: 0,
        currentPlayingIndex: -1,
        waitingForIndex: null,
        isStreamDone: false,
        isAutoSpeak: true,
        cancelled: false,
        abortController: new AbortController()
      };
      streamSessionRef.current = session;
    }

    if (session.cancelled) return;

    const { chunks } = extractSpeechChunks(fullText, true);

    if (chunks.length > session.committedChunksCount) {
      let charSearchIndex = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i]?.trim();
        if (!chunkText) continue;

        const foundCharIdx = fullText.indexOf(chunkText, charSearchIndex);
        const charStart = foundCharIdx !== -1 ? foundCharIdx : charSearchIndex;
        charSearchIndex = charStart + chunkText.length;

        if (i >= session.committedChunksCount) {
          const preText = fullText.slice(0, charStart);
          const wordOffset = countWords(preText);

          session.chunks.push({
            index: session.chunks.length,
            text: chunkText,
            wordOffset,
            audioUrl: null,
            spokenText: null,
            status: 'pending',
            error: null
          });
        }
      }
      session.committedChunksCount = chunks.length;
    }

    // Fallback: If no chunks were extracted, enqueue full text
    if (session.chunks.length === 0 && fullText.trim().length > 0) {
      session.chunks.push({
        index: 0,
        text: fullText.trim(),
        audioUrl: null,
        spokenText: null,
        status: 'pending',
        error: null
      });
      session.committedChunksCount = 1;
    }

    session.isStreamDone = true;
    processStreamingQueue();
  }, [autoPlaySpeech, selectedLanguage, processStreamingQueue]);

  // Manual speaker button playback for a specific completed response
  const play = useCallback(async (messageId, text, langOverride = null, conversationId = null, voiceOverride = null) => {
    if (!text || !text.trim() || !messageId) return;

    const lang = langOverride || selectedLanguage;
    const voice = voiceOverride || selectedVoiceRef.current;
    const cacheKey = `${messageId}_${lang}_${voice}_${playbackSpeedRef.current}`;
    const currentTts = ttsStateRef.current;

    // If currently playing or paused for this exact message, language, and voice: toggle pause/resume
    if (currentTts?.activeMessageId === messageId && currentTts?.activeLang === lang && currentTts?.activeVoice === voice) {
      if (currentTts.status === 'playing') {
        pause();
        return;
      } else if (currentTts.status === 'paused') {
        resume();
        return;
      }
    }

    // Stop any existing audio or auto-speak session (resets to idle, clears error)
    stop();

    // Check in-memory audio cache for instant replay without re-requesting LLM
    const cached = cacheRef.current[cacheKey];
    if (cached?.url) {
      currentGlobalOffsetRef.current = 0;
      const spoken = cached.spokenText || text;
      currentSpokenTextRef.current = spoken;
      lastDispatchedWordIndexRef.current = -1;
      timelineRef.current = buildWordTimeline(spoken, cached.duration || (countWords(spoken) * 0.38), cached.timestamps);

      setTtsState({
        activeMessageId: messageId,
        conversationId,
        status: 'playing',
        error: null,
        activeLang: lang,
        activeVoice: voice,
        spokenText: cached.spokenText,
        isAutoSpeak: false,
        currentChunkIndex: 0,
        totalChunks: 1,
        loadingDescription: null,
        activeWordIndex: 0
      });

      try {
        if (audioRef.current) {
          audioRef.current.src = cached.url;
          try {
            audioRef.current.playbackRate = playbackSpeedRef.current;
            audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
          } catch (_) {}
          await audioRef.current.play();
        }
      } catch (err) {
        setTtsState(prev => ({
          ...prev,
          status: 'error',
          error: 'Unable to start audio playback: ' + err.message
        }));
      }
      return;
    }

    // Guard against duplicate in-flight requests for the exact same message
    if (inFlightRef.current === cacheKey) {
      return;
    }
    inFlightRef.current = cacheKey;
    const currentSessionId = ++activePlaybackSessionIdRef.current;

    setTtsState({
      activeMessageId: messageId,
      conversationId,
      status: 'loading',
      error: null,
      activeLang: lang,
      activeVoice: voice,
      playbackSpeed: playbackSpeedRef.current,
      spokenText: null,
      isAutoSpeak: false,
      currentChunkIndex: 0,
      totalChunks: 1,
      loadingDescription: null,
      activeWordIndex: -1
    });

    try {
      const res = await api.synthesizeSpeech({
        text,
        language: lang,
        voice,
        conversationId,
        messageId,
        speed: playbackSpeedRef.current
      });

      // Verify request wasn't cancelled or superseded while in flight
      if (inFlightRef.current !== cacheKey || activePlaybackSessionIdRef.current !== currentSessionId) {
        return;
      }

      const audioUrl = URL.createObjectURL(res.audioBlob);
      const exactDuration = await getExactAudioDuration(res.audioBlob, res.durationMs);

      cacheRef.current[cacheKey] = {
        url: audioUrl,
        spokenText: res.spokenText,
        duration: exactDuration,
        timestamps: res.timestamps,
        exactAlignment: res.exactAlignment
      };

      currentGlobalOffsetRef.current = 0;
      const spoken = res.spokenText || text;
      currentSpokenTextRef.current = spoken;
      lastDispatchedWordIndexRef.current = -1;
      timelineRef.current = buildWordTimeline(spoken, exactDuration || (countWords(spoken) * 0.38), res.timestamps);

      setTtsState({
        activeMessageId: messageId,
        conversationId,
        status: 'playing',
        error: null,
        activeLang: lang,
        activeVoice: voice,
        playbackSpeed: playbackSpeedRef.current,
        spokenText: res.spokenText,
        isAutoSpeak: false,
        currentChunkIndex: 0,
        totalChunks: 1,
        loadingDescription: null,
        activeWordIndex: 0
      });

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        try {
          audioRef.current.playbackRate = playbackSpeedRef.current;
          audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
        } catch (_) {}
        await audioRef.current.play();
      }
    } catch (err) {
      console.error('[useTtsAudio] Manual speech synthesis failed:', err);
      if (inFlightRef.current === cacheKey && activePlaybackSessionIdRef.current === currentSessionId) {
        let displayError = err.message || 'Speech generation failed';
        if (displayError.includes('preview tier') || displayError.includes('preview_limitation') || displayError.includes('501')) {
          displayError = 'Preview Language: Native speech synthesis requires Bodhan/Bhashini credentials. LLM text generation is fully supported.';
        }
        setTtsState({
          activeMessageId: messageId,
          conversationId,
          status: 'error',
          error: displayError,
          activeLang: lang,
          activeVoice: voice,
          playbackSpeed: playbackSpeedRef.current,
          spokenText: null,
          isAutoSpeak: false,
          currentChunkIndex: 0,
          totalChunks: 0,
          loadingDescription: null
        });
      }
    } finally {
      if (inFlightRef.current === cacheKey) {
        inFlightRef.current = null;
      }
    }
  }, [selectedLanguage, pause, resume, stop]);

  // Explicit retry action requested by user
  const retry = useCallback((messageId, text, langOverride = null, conversationId = null, voiceOverride = null) => {
    // Clear error and trigger play
    setTtsState(prev => ({ ...prev, status: 'idle', error: null }));
    return play(messageId, text, langOverride, conversationId, voiceOverride);
  }, [play]);

  return {
    selectedLanguage,
    setSelectedLanguage,
    selectedVoice,
    setSelectedVoice,
    playbackSpeed,
    setPlaybackSpeed,
    autoPlaySpeech,
    setAutoPlaySpeech,
    ttsState,
    play,
    pause,
    resume,
    stop,
    retry,
    seek,
    seekToWord,
    feedStreamingText,
    finishStreamingSpeech
  };
}
