import React, { useState, useRef, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogContent,
  useTheme
} from '@mui/material';
import {
  Copy,
  Check,
  CheckCircle2,
  RotateCw,
  Sparkles,
  User,
  Bot,
  AlertTriangle,
  Edit2,
  X,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Download,
  Maximize2,
  Wand2,
  Image as ImageIcon,
  FileText,
  Table as TableIcon,
  Volume2,
  Pause,
  Play,
  Square,
  AlertCircle,
  Highlighter,
  Edit3,
  Compass,
  ArrowUpRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';
import { findLanguageByCode, isMatchingScript, detectLanguageFromText } from '../services/languageRegistry';
import { rehypeWordSegmenter, rehypeHighlightApplier } from '../services/useTtsAudio';
import { computeDomSelectionOffsets, normalizeHighlightColor } from '../services/textAnnotationEngine';
import ThreeDotImageLoader from './ThreeDotImageLoader';
import AnimatedThreeDots from './AnimatedThreeDots';

export default function MessageItem({
  message,
  onRegenerate,
  onRegenerateWithModel,
  onRefineImage,
  onSelectSuggestion,
  onSelectFollowUpSuggestion,
  onPopulateSuggestion,
  onEditUserMessage,
  onEditAssistantMessage,
  isLatest = false,
  isGenerating = false,
  isStreaming: propIsStreaming = false,
  isAnyGenerating = false,
  ttsState,
  onPlaySpeech,
  onPauseSpeech,
  onResumeSpeech,
  onStopSpeech,
  onRetrySpeech,
  onSeekToWord,
  selectedLanguage = 'en',
  selectedVoice = 'default',
  playbackSpeed = 1.0,
  onSelectSpeed,
  highlights = [],
  highlightMode = false,
  isHighlightMode = false,
  activeHighlightColor = 'rgba(16, 185, 129, 0.28)',
  activeHighlightColorKey = 'green',
  onSaveHighlight,
  onSelectHighlightText,
  onEditHighlight,
  onClearMessageHighlights
}) {
  const activeHighlightMode = Boolean(isHighlightMode || highlightMode);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const isThisSpeaking = ttsState?.activeMessageId === message.id && (ttsState?.status === 'playing' || ttsState?.status === 'paused');
  const currentWordIndex = isThisSpeaking ? (ttsState?.activeWordIndex ?? -1) : -1;

  const contentContainerRef = useRef(null);
  const wordTimersRef = useRef(new Map()); // wordIndex -> timerId
  const activeWordRef = useRef(-1);

  const isThisSpeakingRef = useRef(isThisSpeaking);
  useEffect(() => {
    isThisSpeakingRef.current = isThisSpeaking;
  }, [isThisSpeaking]);

  const onSeekToWordRef = useRef(onSeekToWord);
  useEffect(() => {
    onSeekToWordRef.current = onSeekToWord;
  }, [onSeekToWord]);

  // Audio-Synchronized Temporary Underline Engine
  // Controls word states: 'pending' -> 'active' -> 'fading' -> 'inactive'
  // - Activation is derived strictly from real-time audio.currentTime
  // - Smooth 1-2s opacity fade-out as speech advances
  // - Automatic reconciliation on seeking, pause/resume, replay, speed changes, and message switching
  useEffect(() => {
    const container = contentContainerRef.current;
    if (!container) return;

    // Dynamically calculate fade duration based on playback speed (1–2 seconds)
    // 0.5x -> 1800ms, 1x -> 1500ms, 1.5x -> 1200ms, 2x -> 1000ms
    const speed = Number(playbackSpeed) || 1.0;
    const fadeDurationMs = Math.round(Math.max(1000, Math.min(2000, 1500 / speed)));
    container.style.setProperty('--tts-fade-duration', `${fadeDurationMs}ms`);

    const setWordElementState = (el, state) => {
      if (!el) return;
      el.setAttribute('data-tts-state', state);
      el.classList.remove('tts-word-active', 'tts-word-fading', 'tts-word-inactive');
      if (state === 'active') {
        el.classList.add('tts-word-active');
      } else if (state === 'fading') {
        el.classList.add('tts-word-fading');
      } else if (state === 'inactive') {
        el.classList.add('tts-word-inactive');
      }
    };

    // Case 1: Audio is speaking (playing or paused) and a valid word index is active
    if (isThisSpeaking && currentWordIndex >= 0) {
      const prevActive = activeWordRef.current;

      if (currentWordIndex !== prevActive) {
        const isSequential = prevActive >= 0 && currentWordIndex === prevActive + 1;

        if (!isSequential) {
          // Reconcile jumped/non-sequential position (e.g. forward/backward seek or restart)
          wordTimersRef.current.forEach(timerId => clearTimeout(timerId));
          wordTimersRef.current.clear();

          const allWordEls = container.querySelectorAll('.tts-word');
          allWordEls.forEach(el => {
            const idx = Number(el.getAttribute('data-word-index'));
            if (idx === currentWordIndex) {
              // Target word: will become active
            } else if (idx === currentWordIndex - 1 && prevActive !== -1) {
              // Immediately preceding word can start fading
              setWordElementState(el, 'fading');
              const tid = setTimeout(() => {
                wordTimersRef.current.delete(idx);
                setWordElementState(el, 'inactive');
              }, fadeDurationMs);
              wordTimersRef.current.set(idx, tid);
            } else if (idx < currentWordIndex) {
              setWordElementState(el, 'inactive');
            } else {
              setWordElementState(el, 'pending');
            }
          });
        } else if (prevActive >= 0) {
          // Normal sequential progression: start fading out previous underline
          const prevEl = container.querySelector(`[data-word-index="${prevActive}"]`);
          if (prevEl) {
            setWordElementState(prevEl, 'fading');

            const existingTimer = wordTimersRef.current.get(prevActive);
            if (existingTimer) clearTimeout(existingTimer);

            const tid = setTimeout(() => {
              wordTimersRef.current.delete(prevActive);
              if (prevEl.getAttribute('data-tts-state') === 'fading') {
                setWordElementState(prevEl, 'inactive');
              }
            }, fadeDurationMs);

            wordTimersRef.current.set(prevActive, tid);
          }
        }

        // Activate currently spoken word immediately
        activeWordRef.current = currentWordIndex;
        const nextActiveEl = container.querySelector(`[data-word-index="${currentWordIndex}"]`);
        if (nextActiveEl) {
          const existingTimer = wordTimersRef.current.get(currentWordIndex);
          if (existingTimer) {
            clearTimeout(existingTimer);
            wordTimersRef.current.delete(currentWordIndex);
          }

          setWordElementState(nextActiveEl, 'active');

          // Gentle auto-scroll: only scroll when word is outside visible container boundaries
          const wordRect = nextActiveEl.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          if (wordRect.top < containerRect.top - 12 || wordRect.bottom > containerRect.bottom + 12) {
            nextActiveEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }
        }
      }
    }
    // Case 2: Audio ended, stopped, or switched
    else {
      const lastActive = activeWordRef.current;
      if (lastActive >= 0) {
        activeWordRef.current = -1;
        const lastEl = container.querySelector(`[data-word-index="${lastActive}"]`);
        if (lastEl) {
          // Allow final word underline to fade away smoothly over 1-2s on natural completion
          setWordElementState(lastEl, 'fading');
          const tid = setTimeout(() => {
            wordTimersRef.current.delete(lastActive);
            setWordElementState(lastEl, 'inactive');
          }, fadeDurationMs);
          wordTimersRef.current.set(lastActive, tid);
        }
      }

      // If audio is completely stopped (not speaking), clean up any lingering active elements
      if (!isThisSpeaking) {
        const lingeringActive = container.querySelectorAll('.tts-word[data-tts-state="active"]');
        lingeringActive.forEach(el => setWordElementState(el, 'inactive'));
      }
    }
  }, [isThisSpeaking, currentWordIndex, playbackSpeed]);

  // Clean up all active timers when unmounting or switching messages
  useEffect(() => {
    return () => {
      wordTimersRef.current.forEach(timerId => clearTimeout(timerId));
      wordTimersRef.current.clear();
      activeWordRef.current = -1;
    };
  }, [message.id]);

  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [isCheckingProvider, setIsCheckingProvider] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  const handleCheckProvider = async () => {
    setIsCheckingProvider(true);
    try {
      const providerId = message.failedProvider?.toLowerCase().includes('gemini') ? 'gemini' 
        : (message.failedProvider?.toLowerCase().includes('openai') ? 'openai' : 'gemini');
      const modelId = message.failedModelId || 'gemini-3.1-flash-image';
      const result = await api.checkImageProvider(providerId, modelId);
      setCheckResult(result);
    } catch (err) {
      setCheckResult({
        status: 'ERROR',
        errorMessage: err.message || 'Provider check failed.'
      });
    } finally {
      setIsCheckingProvider(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleStartEdit = () => {
    setEditContent(message.content || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content || '');
  };

  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    setIsEditing(false);
    if (isUser) {
      onEditUserMessage?.(message.id, editContent.trim());
    } else {
      onEditAssistantMessage?.(message.id, editContent.trim());
    }
  };

  const isGeneratingActive = Boolean(isGenerating || propIsStreaming || message.isGenerating || message.status === 'streaming');
  const isCancelled = Boolean(message.isCancelled || message.status === 'cancelled' || message.interrupted);
  const isThinking = !isUser && isGeneratingActive && !isCancelled && !message.error && (!message.content || message.content.length === 0);
  const isStreaming = !isUser && !isCancelled && (propIsStreaming || (isGeneratingActive && (isLatest || message.status === 'streaming') && message.content && message.content.length > 0));
  const hasError = !isUser && (message.error || (message.content && message.content.startsWith('⚠️')));

  const isImageModel = Boolean(
    (message.modelId && (
      message.modelId.toLowerCase().includes('flux') ||
      message.modelId.toLowerCase().includes('stable-diffusion') ||
      message.modelId.toLowerCase().includes('sdxl') ||
      message.modelId.toLowerCase().includes('text-to-image') ||
      message.modelId.toLowerCase().includes('image') ||
      message.modelId.toLowerCase().includes('banana') ||
      message.modelId.toLowerCase().includes('flare') ||
      message.modelId.toLowerCase().includes('sunburst')
    )) ||
    (message.modelName && (
      message.modelName.toLowerCase().includes('flux') ||
      message.modelName.toLowerCase().includes('diffusion') ||
      message.modelName.toLowerCase().includes('image') ||
      message.modelName.toLowerCase().includes('banana') ||
      message.modelName.toLowerCase().includes('flare') ||
      message.modelName.toLowerCase().includes('sunburst')
    )) ||
    message.taskType === 'TEXT_TO_IMAGE' ||
    message.type === 'image'
  );

  let generatedImgData = message.generatedImage || null;
  if (!generatedImgData && message.content) {
    const imgMatch = message.content.match(/!\[(.*?)\]\((data:image\/[a-zA-Z]+;base64,[^)]+|https?:\/\/[^)]+)\)/);
    if (imgMatch) {
      generatedImgData = {
        prompt: imgMatch[1] || 'Generated Image',
        imageDataUrl: imgMatch[2],
        modelName: message.modelName || (message.modelId || 'FLUX.1 [schnell]'),
        modelId: message.modelId,
        durationMs: message.durationMs,
        enhancedPrompt: message.enhancedPrompt,
        originalPrompt: message.originalPrompt || imgMatch[1],
        fallbackFrom: message.fallbackFrom,
        fallbackReason: message.fallbackReason,
        seed: message.seed,
        structuredSpec: message.structuredSpec
      };
    }
  }

  const detectedLang = detectLanguageFromText(message.content);
  const effectiveLang = message.language || detectedLang || selectedLanguage || 'en';
  const activeLangCode = isThisSpeaking ? (ttsState?.activeLang || effectiveLang) : effectiveLang;

  // Check if audio spoken text is in a different script/language than original message content
  const isSpokenTextDifferent = Boolean(
    isThisSpeaking &&
    ttsState?.spokenText &&
    ttsState.spokenText.trim() &&
    ttsState.activeLang !== 'en' &&
    !isMatchingScript(message.content, ttsState.activeLang)
  );

  // Immutable response content: The complete AI-generated message must remain
  // fully visible and intact before, during, and after audio speech playback.
  // Visual underline states are applied via DOM attributes (data-tts-state) on segmented word spans,
  // never by overwriting, truncating, or replacing the response content.
  const rawContent = message.content || '';
  const displayContent = generatedImgData && rawContent
    ? rawContent.replace(/!\[(.*?)\]\((data:image\/[a-zA-Z]+;base64,[^)]+|https?:\/\/[^)]+)\)/g, '').trim()
    : rawContent;

  // Highlights for this specific message
  const messageHighlights = useMemo(() => {
    return (highlights || []).filter(h => h.messageId === message.id);
  }, [highlights, message.id]);

  // Memoize Markdown rendering strictly on displayContent, messageHighlights, and isStreaming
  // to eliminate re-parsing overhead and prevent virtual DOM reconciliation from resetting
  // temporary spoken word underline attributes during audio playback.
  // When streaming, skip word segmentation plugin to prevent parsing hundreds of spans per token (maintains 60fps).
  const renderedMarkdown = useMemo(() => {
    if (!displayContent) return null;
    const activeRehypePlugins = isStreaming
      ? [[rehypeHighlightApplier, { highlights: messageHighlights }]]
      : [
          [rehypeHighlightApplier, { highlights: messageHighlights }],
          rehypeWordSegmenter
        ];

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={activeRehypePlugins}
        components={{
          mark({ node, children, className, style, ...props }) {
            const hlColor = props['data-highlight-color'];
            const bg = normalizeHighlightColor(hlColor || (typeof style === 'object' ? style?.backgroundColor : style), 0.28);
            return (
              <mark
                {...props}
                className="rgb-marker-highlight"
                style={{
                  backgroundColor: bg,
                  ...(typeof style === 'object' ? style : {})
                }}
                title="Click to edit or remove highlight"
              >
                {children}
              </mark>
            );
          },
          span({ node, children, className, ...props }) {
            const wordIdx = props['data-word-index'];
            if (wordIdx !== undefined) {
              return (
                <span
                  {...props}
                  className="tts-word"
                  data-word-index={wordIdx}
                  data-tts-state="pending"
                  onClick={(e) => {
                    if (isThisSpeakingRef.current && onSeekToWordRef.current) {
                      e.stopPropagation();
                      onSeekToWordRef.current(Number(wordIdx));
                    }
                  }}
                  title={isThisSpeakingRef.current ? `Click to seek speech to word #${wordIdx}` : undefined}
                >
                  {children}
                </span>
              );
            }
            return <span {...props}>{children}</span>;
          },
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (!inline && (match || codeString.includes('\n'))) {
              return (
                <CodeBlock
                  language={match ? match[1] : ''}
                  value={codeString}
                />
              );
            }

            return (
              <code
                style={{
                  backgroundColor: 'rgba(150,150,150,0.15)',
                  padding: '2px 6px',
                  borderRadius: '5px',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.85em'
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          a({ href, children, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#10a37f',
                  textDecoration: 'none',
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(16, 163, 127, 0.1)',
                  border: '1px solid rgba(16, 163, 127, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  margin: '0 2px',
                  fontSize: '0.88em'
                }}
                {...props}
              >
                {children}
                <ExternalLink size={10} style={{ display: 'inline', opacity: 0.8 }} />
              </a>
            );
          }
        }}
      >
        {displayContent}
      </ReactMarkdown>
    );
  }, [displayContent, messageHighlights, isStreaming]);

  // Handle user dragging text selection to highlight text
  const handleContentMouseUp = (e) => {
    // If highlight mode is OFF, text selection behaves completely normally!
    if (!activeHighlightMode) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (!contentContainerRef.current?.contains(range.commonAncestorContainer) &&
        range.commonAncestorContainer !== contentContainerRef.current) {
      return;
    }

    const offsets = computeDomSelectionOffsets(contentContainerRef.current, range);
    if (!offsets || !offsets.text || !offsets.text.trim()) return;

    const rect = range.getBoundingClientRect();

    if (onSelectHighlightText) {
      onSelectHighlightText({
        messageId: message.id,
        conversationId: message.conversationId,
        text: offsets.text,
        startOffset: offsets.startOffset,
        endOffset: offsets.endOffset,
        prefix: offsets.prefix,
        suffix: offsets.suffix,
        rect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height
        }
      });
    }
  };

  // Handle clicking an existing highlight to edit or remove it
  const handleContentClick = (e) => {
    const markEl = e.target.closest('.rgb-marker-highlight');
    if (markEl) {
      e.stopPropagation();
      const hlId = markEl.getAttribute('data-highlight-id');
      const hl = messageHighlights.find(h => h.id === hlId);
      if (hl && onEditHighlight) {
        const rect = markEl.getBoundingClientRect();
        onEditHighlight(hl, {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height
        });
      }
    }
  };

  const handleDownloadImage = () => {
    if (!generatedImgData?.imageDataUrl) return;
    const a = document.createElement('a');
    a.href = generatedImgData.imageDataUrl;
    const cleanPrompt = (generatedImgData.prompt || 'generated_image')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 30);
    a.download = `${cleanPrompt}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Box
      className="message-fade-in"
      sx={{
        width: '100%',
        maxWidth: '768px',
        mx: 'auto',
        my: 1.5,
        px: { xs: 1.5, sm: 2 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start'
      }}
    >
      {/* Message Row */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isUser ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          gap: 1.5,
          maxWidth: isUser ? { xs: '92%', sm: '85%', md: '78%' } : '100%',
          width: isUser ? 'auto' : '100%'
        }}
      >
        {/* Avatar / Response Header Icon */}
        <Box
          className={`chat-avatar ${isUser ? 'chat-user-avatar' : 'chat-response-header chat-response-avatar'}`}
          data-testid={isUser ? 'user-avatar' : 'chat-response-header'}
          aria-label={isUser ? 'User avatar' : 'AI avatar'}
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mt: isUser ? 0.3 : 0.4,
            backgroundColor: isUser ? 'background.hover' : 'primary.main',
            color: isUser ? 'text.secondary' : '#ffffff',
            border: isUser ? '1px solid' : 'none',
            borderColor: 'divider',
            boxShadow: isUser ? 'none' : '0 2px 8px rgba(16, 163, 127, 0.3)'
          }}
        >
          {isUser ? <User size={16} /> : <Bot size={17} />}
        </Box>

        {/* Message Container */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start',
            minWidth: 0,
            width: '100%'
          }}
        >
          {/* User Message Header */}
          {isUser && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.8,
                mb: 0.4,
                px: 0.5,
                flexDirection: 'row-reverse'
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.78rem' }}>
                You
              </Typography>

              {/* User Edit Button */}
              {!isGenerating && !isEditing && (
                <Tooltip title="Edit prompt">
                  <IconButton
                    size="small"
                    onClick={handleStartEdit}
                    sx={{
                      p: 0.3,
                      color: 'text.disabled',
                      '&:hover': { color: 'text.primary' }
                    }}
                  >
                    <Edit2 size={12} />
                  </IconButton>
                </Tooltip>
              )}

              {/* User Message Highlights Indicator & Clear */}
              {messageHighlights.length > 0 && (
                <Tooltip title={`Clear ${messageHighlights.length} highlight${messageHighlights.length > 1 ? 's' : ''} on your prompt`}>
                  <IconButton
                    size="small"
                    onClick={() => onClearMessageHighlights && onClearMessageHighlights(message.id)}
                    sx={{
                      p: 0.3,
                      color: '#d97706',
                      '&:hover': { color: 'error.main' }
                    }}
                  >
                    <Highlighter size={12} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}

          {/* User Attachments */}
          {isUser && message.attachments && message.attachments.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {message.attachments.map((att, idx) => (
                <Box
                  key={idx}
                  sx={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    maxWidth: 220,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                >
                  {att.dataUrl?.startsWith('data:image') ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name || 'attachment'}
                      style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 160, objectFit: 'cover' }}
                    />
                  ) : (
                    <Box sx={{ p: 1.2, backgroundColor: 'background.card', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ p: 0.8, borderRadius: '8px', backgroundColor: 'rgba(16, 163, 127, 0.1)', color: 'primary.main', display: 'flex' }}>
                        {att.name?.toLowerCase().includes('.xls') || att.name?.toLowerCase().includes('.csv') ? <TableIcon size={18} /> : <FileText size={18} />}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" noWrap sx={{ fontWeight: 600, display: 'block', fontSize: '0.8rem' }}>
                          {att.name || 'Attached Document'}
                        </Typography>
                        {att.formattedSize && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                            {att.formattedSize}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Message Bubble: Modern ChatGPT styling */}
          <Box
            sx={{
              p: isUser ? '10px 16px' : (hasError ? '14px 18px' : '4px 0'),
              borderRadius: isUser ? '20px 20px 4px 20px' : '12px',
              backgroundColor: isUser
                ? 'background.userBubble'
                : (hasError ? 'rgba(239, 68, 68, 0.08)' : 'transparent'),
              border: hasError ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
              color: 'text.primary',
              textAlign: 'left',
              wordBreak: 'break-word',
              width: '100%'
            }}
          >
            {/* Inline Edit Form */}
            {isEditing ? (
              <Box sx={{ width: '100%', py: 0.5 }}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={Math.min(Math.max(editContent.split('\n').length, 3), 10)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #10a37f',
                    backgroundColor: 'rgba(16, 163, 127, 0.05)',
                    color: 'inherit',
                    fontFamily: 'inherit',
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 1, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleCancelEdit}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.8rem', py: 0.4 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={handleSaveEdit}
                    disabled={!editContent.trim()}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.8rem', py: 0.4 }}
                  >
                    {isUser ? 'Save & Submit' : 'Save'}
                  </Button>
                </Box>
              </Box>
            ) : (
              <>
                {/* Thinking Pulse Dots or Diffusion Progress Indicator */}
                {isThinking && (
                  isImageModel ? (
                    <ThreeDotImageLoader
                      modelId={message.modelId}
                      modelName={message.modelName}
                      hasReference={Boolean(message.hasReference || message.referenceImages?.length)}
                      referenceInstruction={message.referenceInstruction}
                      prompt={message.prompt || ''}
                    />
                  ) : (
                    <AnimatedThreeDots
                      variant="thinking"
                      label="Thinking..."
                      modelName={message.modelName || message.modelId}
                    />
                  )
                )}

                {/* Diagnostic Image Generation Error Card */}
                {message.error && (
                  <Box sx={{
                    my: 1.5,
                    p: 2,
                    borderRadius: 2.5,
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid',
                    borderColor: 'error.main',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
                      <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'error.main', mb: 0.5 }}>
                          {message.failedProvider || 'Gemini'} image generation is unavailable
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary', whiteSpace: 'pre-line', lineHeight: 1.5, mb: 0.5 }}>
                          <strong>Reason:</strong> {message.errorReason || (message.errorCategory === 'ZERO_QUOTA' ? "The selected project's image-generation quota is zero (`limit: 0`)." : message.error)}
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.82rem', color: 'text.secondary', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                          <strong>Next step:</strong> {message.errorNextStep || "Verify the project's billing and quota status in Google AI Studio, or select a configured alternative."}
                        </Typography>

                        {/* Live Check Result Badge if available */}
                        {checkResult && (
                          <Box sx={{
                            mt: 1,
                            p: 1,
                            borderRadius: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            backgroundColor: checkResult.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid',
                            borderColor: checkResult.status === 'AVAILABLE' ? '#10b981' : '#f59e0b'
                          }}>
                            {checkResult.status === 'AVAILABLE' ? (
                              <CheckCircle2 size={15} color="#10b981" />
                            ) : (
                              <AlertCircle size={15} color="#f59e0b" />
                            )}
                            <Typography variant="caption" sx={{ fontWeight: 600, color: checkResult.status === 'AVAILABLE' ? '#10b981' : '#d97706' }}>
                              Provider Check ({checkResult.status}): {checkResult.errorMessage || checkResult.errorReason || 'Status verified.'}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {/* Explicit Failover and Recovery Actions */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pt: 1, borderTop: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                      {/* Check Provider button */}
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        startIcon={isCheckingProvider ? <CircularProgress size={13} color="inherit" /> : <RotateCw size={13} />}
                        onClick={handleCheckProvider}
                        disabled={isCheckingProvider}
                        sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.78rem', py: 0.5, px: 1.2, fontWeight: 600 }}
                      >
                        {isCheckingProvider ? 'Checking Provider...' : 'Check Provider'}
                      </Button>

                      {/* Open Billing Documentation button */}
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<ExternalLink size={13} />}
                        component="a"
                        href={message.docUrl || 'https://ai.google.dev/gemini-api/docs/billing'}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.78rem', py: 0.5, px: 1.2 }}
                      >
                        Open Billing Documentation
                      </Button>

                      {/* Try with Free Diffusion */}
                      {(message.canFallback || message.errorCategory === 'ZERO_QUOTA' || message.errorCategory === 'QUOTA_EXCEEDED' || message.errorCategory === 'BILLING_REQUIRED' || message.errorCategory === 'PAYMENT_REQUIRED') && onRegenerateWithModel && (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<Sparkles size={14} />}
                          onClick={() => onRegenerateWithModel(message.fallbackModelId || 'flux-schnell-free')}
                          disabled={isGenerating || isAnyGenerating}
                          sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.78rem', py: 0.5, px: 1.4, fontWeight: 700 }}
                        >
                          Try with Free Diffusion (FLUX / Sana)
                        </Button>
                      )}

                      {/* Retry Request - enabled when canRetry is true or check passed */}
                      {onRegenerate && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          startIcon={<RotateCw size={13} />}
                          onClick={() => onRegenerate(message.originalPrompt || message.prompt || '')}
                          disabled={isGenerating || isAnyGenerating || (!message.canRetry && (!checkResult || checkResult.status !== 'AVAILABLE'))}
                          title={!message.canRetry && (!checkResult || checkResult.status !== 'AVAILABLE') ? 'Cannot retry while quota is zero. Click Check Provider after linking billing.' : 'Retry request'}
                          sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.78rem', py: 0.5, px: 1.2 }}
                        >
                          Retry Request
                        </Button>
                      )}

                      {/* Inspect Details */}
                      <Button
                        size="small"
                        variant="text"
                        color="secondary"
                        startIcon={<AlertCircle size={13} />}
                        onClick={() => setInspectOpen(true)}
                        sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.78rem', py: 0.5, px: 1.2 }}
                      >
                        Inspect Details
                      </Button>
                    </Box>
                  </Box>
                )}

                {/* Dedicated Generated Image Card */}
                {generatedImgData && (
                  <Box
                    sx={{
                      my: 1.5,
                      borderRadius: 3,
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: 'background.card',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                      width: '100%',
                      maxWidth: { xs: '100%', sm: 540 }
                    }}
                  >
                    {/* Image Preview with Zoom on Click */}
                    <Box
                      onClick={() => setZoomOpen(true)}
                      sx={{
                        position: 'relative',
                        cursor: 'zoom-in',
                        backgroundColor: '#0a0a0a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        '&:hover .image-overlay-actions': {
                          opacity: 1
                        }
                      }}
                    >
                      <img
                        src={generatedImgData.imageDataUrl}
                        alt={generatedImgData.prompt || 'Generated Image'}
                        style={{
                          width: '100%',
                          maxHeight: 460,
                          objectFit: 'contain',
                          display: 'block'
                        }}
                      />

                      {/* Hover Action Overlay */}
                      <Box
                        className="image-overlay-actions"
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'flex-end',
                          p: 1.2,
                          opacity: { xs: 1, sm: 0 },
                          transition: 'opacity 0.2s ease',
                          pointerEvents: 'none'
                        }}
                      >
                        <Box sx={{ pointerEvents: 'auto', display: 'flex', gap: 0.8 }}>
                          <Tooltip title="View Fullscreen">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); setZoomOpen(true); }}
                              sx={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', '&:hover': { backgroundColor: 'rgba(0,0,0,0.85)' } }}
                            >
                              <Maximize2 size={15} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </Box>

                    {/* Card Footer with Details and Buttons */}
                    <Box sx={{ p: 1.5, backgroundColor: 'background.card', display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {generatedImgData.prompt && (
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'text.primary', lineHeight: 1.4 }}>
                          "{generatedImgData.prompt}"
                        </Typography>
                      )}

                      {generatedImgData.fallbackFrom && (
                        <Box sx={{
                          p: 1.2,
                          borderRadius: 2,
                          backgroundColor: isDark ? 'rgba(255, 171, 0, 0.1)' : 'rgba(255, 171, 0, 0.12)',
                          border: '1px solid',
                          borderColor: 'warning.main',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.4
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <AlertTriangle size={14} color="#ffab00" />
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'warning.main' }}>
                              Transparent Failover Attribution
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4 }}>
                            Requested: <strong>{generatedImgData.fallbackFrom}</strong> • Generated by: <strong>{generatedImgData.modelName}</strong> ({generatedImgData.actualProvider || 'Pollinations Free Tier'})
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                            {generatedImgData.fallbackReason || 'Google Gemini requires a Pay-as-you-go billing account. Synthesized using free hosted diffusion.'}
                          </Typography>
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                          <Chip
                            icon={<ImageIcon size={12} color="#ec4899" />}
                            label={generatedImgData.modelName || 'FLUX.1 [schnell]'}
                            size="small"
                            sx={{ height: 20, fontSize: '0.675rem', fontWeight: 700, backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}
                          />
                          {generatedImgData.durationMs > 0 && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                              {(generatedImgData.durationMs / 1000).toFixed(1)}s
                            </Typography>
                          )}
                        </Box>

                        {/* Action Buttons: Download, Inspect, Refine, Generate Another */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Download size={14} />}
                            onClick={handleDownloadImage}
                            sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem', py: 0.4, px: 1.2 }}
                          >
                            Download
                          </Button>

                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Sparkles size={14} />}
                            onClick={() => setInspectOpen(true)}
                            sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem', py: 0.4, px: 1.2 }}
                          >
                            Inspect
                          </Button>

                          {onRefineImage && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="secondary"
                              startIcon={<Edit2 size={13} />}
                              onClick={() => onRefineImage(generatedImgData.imageDataUrl, generatedImgData.prompt)}
                              sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem', py: 0.4, px: 1.2 }}
                            >
                              Refine
                            </Button>
                          )}

                          {onRegenerate && (
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              startIcon={<RotateCw size={14} />}
                              onClick={() => onRegenerate(generatedImgData.prompt)}
                              disabled={isGenerating || isAnyGenerating}
                              sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem', py: 0.4, px: 1.2 }}
                            >
                              Generate Another
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Box>

                    {/* Fullscreen Zoom Dialog */}
                    <Dialog
                      open={zoomOpen}
                      onClose={() => setZoomOpen(false)}
                      maxWidth="lg"
                      PaperProps={{ sx: { backgroundColor: 'transparent', boxShadow: 'none', overflow: 'hidden' } }}
                    >
                      <DialogContent sx={{ p: 0, position: 'relative' }}>
                        <IconButton
                          onClick={() => setZoomOpen(false)}
                          sx={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            color: '#ffffff',
                            '&:hover': { backgroundColor: 'rgba(0,0,0,0.9)' },
                            zIndex: 10
                          }}
                        >
                          <X size={20} />
                        </IconButton>
                        <img
                          src={generatedImgData.imageDataUrl}
                          alt="Zoomed View"
                          style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12, display: 'block' }}
                        />
                      </DialogContent>
                    </Dialog>
                  </Box>
                )}

                {/* Prompt & Generation Inspect Dialog (Accessible for both success & error) */}
                <Dialog
                  open={inspectOpen}
                  onClose={() => setInspectOpen(false)}
                  maxWidth="sm"
                  fullWidth
                  PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
                >
                  <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Sparkles size={18} color="#10a37f" /> Image Pipeline & Prompt Diagnostics
                      </Typography>
                      <IconButton size="small" onClick={() => setInspectOpen(false)}>
                        <X size={18} />
                      </IconButton>
                    </Box>

                    {/* 1. Original User Prompt */}
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                        1. Original User Prompt (Source of Truth)
                      </Typography>
                      <Typography variant="body2" sx={{ p: 1.5, borderRadius: 2, backgroundColor: 'action.hover', mt: 0.5, fontFamily: 'monospace' }}>
                        {generatedImgData?.originalPrompt || generatedImgData?.prompt || message.originalPrompt || message.prompt || 'None provided'}
                      </Typography>
                    </Box>

                    {/* 2. Domain Entity Resolution */}
                    {Boolean(generatedImgData?.structuredSpec?.entityResolved || message?.structuredSpec?.entityResolved) && (
                      <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', display: 'block', mb: 0.6 }}>
                          2. Domain Entity & Likeness Disambiguation
                        </Typography>
                        {(generatedImgData?.structuredSpec?.resolvedEntity || message?.structuredSpec?.resolvedEntity) && (
                          <Typography variant="body2" sx={{ fontSize: '0.82rem', mb: 0.4 }}>
                            <strong>Entity Identified:</strong> {generatedImgData?.structuredSpec?.resolvedEntity || message?.structuredSpec?.resolvedEntity}
                          </Typography>
                        )}
                        {(generatedImgData?.structuredSpec?.resolvedClothing || message?.structuredSpec?.resolvedClothing) && (
                          <Typography variant="body2" sx={{ fontSize: '0.82rem', mb: 0.4 }}>
                            <strong>Official Uniform / Kit:</strong> {generatedImgData?.structuredSpec?.resolvedClothing || message?.structuredSpec?.resolvedClothing}
                          </Typography>
                        )}
                        {(generatedImgData?.structuredSpec?.likenessDetails || message?.structuredSpec?.likenessDetails) && (
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', display: 'block' }}>
                            <strong>Facial & Athletic Likeness:</strong> {generatedImgData?.structuredSpec?.likenessDetails || message?.structuredSpec?.likenessDetails}
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* 3. Model-Specific Prompt Sent to Provider */}
                    {(generatedImgData?.enhancedPrompt || message?.enhancedPrompt || generatedImgData?.structuredSpec?.modelSpecificPrompt || message?.structuredSpec?.modelSpecificPrompt) && (
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', textTransform: 'uppercase' }}>
                          3. Final Model-Specific Synthesis Prompt
                        </Typography>
                        <Typography variant="body2" sx={{ p: 1.5, borderRadius: 2, backgroundColor: 'rgba(16, 163, 127, 0.08)', border: '1px solid rgba(16, 163, 127, 0.25)', mt: 0.5, fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.5 }}>
                          {generatedImgData?.enhancedPrompt || message?.enhancedPrompt || generatedImgData?.structuredSpec?.modelSpecificPrompt || message?.structuredSpec?.modelSpecificPrompt}
                        </Typography>
                      </Box>
                    )}

                    {/* 4. Model & Diagnostics Metadata */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                      <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Active Model</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{generatedImgData?.modelName || message.modelName || generatedImgData?.modelId || message.modelId || 'flux-schnell-free'}</Typography>
                      </Box>
                      <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Synthesis Duration</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{generatedImgData?.durationMs ? `${(generatedImgData.durationMs / 1000).toFixed(2)}s` : (message.durationMs ? `${(message.durationMs / 1000).toFixed(2)}s` : 'Real-time')}</Typography>
                      </Box>
                    </Box>

                    {/* 5. Failover Notice if Switched */}
                    {(generatedImgData?.fallbackFrom || message.fallbackFrom) && (
                      <Box sx={{
                        p: 1.5,
                        borderRadius: 2,
                        backgroundColor: isDark ? 'rgba(255, 171, 0, 0.1)' : 'rgba(255, 171, 0, 0.12)',
                        border: '1px solid',
                        borderColor: 'warning.main',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <AlertTriangle size={15} color="#ffab00" />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'warning.main' }}>
                            Transparent Failover Disclosure
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.primary' }}>
                          Requested: <code>{generatedImgData?.fallbackFrom || message.fallbackFrom}</code> • Synthesized by: <strong>{generatedImgData?.modelName || message.modelName}</strong>
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          Reason: {generatedImgData?.fallbackReason || message.fallbackReason || 'Google Gemini requires a Pay-as-you-go billing account. Free diffusion model utilized.'}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
                          Watermark Notice: Free tier images served via Pollinations include a subtle watermark logo.
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={promptCopied ? <Check size={14} /> : <Copy size={14} />}
                        onClick={() => {
                          const p = generatedImgData?.enhancedPrompt || message?.enhancedPrompt || generatedImgData?.prompt || message.prompt || '';
                          navigator.clipboard.writeText(p);
                          setPromptCopied(true);
                          setTimeout(() => setPromptCopied(false), 2000);
                        }}
                        sx={{ borderRadius: 2 }}
                      >
                        {promptCopied ? 'Copied' : 'Copy Prompt'}
                      </Button>
                      <Button variant="contained" size="small" onClick={() => setInspectOpen(false)} sx={{ borderRadius: 2 }}>
                        Close
                      </Button>
                    </Box>
                  </DialogContent>
                </Dialog>

                {/* Audio-synchronized Indian language indicator if translated for speech */}
                {!isThinking && isSpokenTextDifferent && (
                  <Box sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.8,
                    mb: 1.2,
                    px: 1.2,
                    py: 0.5,
                    borderRadius: 1.5,
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.2)',
                    fontSize: '0.8rem',
                    color: isDark ? '#93c5fd' : '#1d4ed8'
                  }}>
                    <Volume2 size={13} />
                    <span>Reading aloud in <strong>{findLanguageByCode(ttsState.activeLang)?.nativeLabel || ttsState.activeLang}</strong> (audio-synchronized)</span>
                  </Box>
                )}

                {/* Render Markdown Content */}
                {!isThinking && displayContent && (
                  <Box
                    ref={contentContainerRef}
                    className={isThisSpeaking ? 'tts-speaking-container' : undefined}
                    onMouseUp={handleContentMouseUp}
                    onClick={handleContentClick}
                    sx={{
                      fontSize: '0.975rem',
                      lineHeight: 1.7,
                      letterSpacing: '-0.005em',
                      color: 'text.primary',
                      '& p': { my: 0.8 },
                      '& p:first-of-type': { mt: 0 },
                      '& p:last-of-type': { mb: 0 },
                      '& h1': {
                        fontSize: '1.45rem',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        mt: 2,
                        mb: 1,
                        lineHeight: 1.3
                      },
                      '& h2': {
                        fontSize: '1.25rem',
                        fontWeight: 650,
                        letterSpacing: '-0.015em',
                        mt: 1.8,
                        mb: 0.8,
                        lineHeight: 1.35
                      },
                      '& h3': {
                        fontSize: '1.08rem',
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                        mt: 1.5,
                        mb: 0.6,
                        lineHeight: 1.4
                      },
                      '& h4': {
                        fontSize: '0.98rem',
                        fontWeight: 600,
                        mt: 1.2,
                        mb: 0.4,
                        lineHeight: 1.45
                      },
                      '& ul, & ol': { pl: 2.5, my: 0.8 },
                      '& li': { my: 0.35, lineHeight: 1.65 },
                      '& a': {
                        color: 'primary.main',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' }
                      },
                      '& hr': {
                        border: 'none',
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        my: 2
                      },
                      '& table': {
                        width: '100%',
                        borderCollapse: 'separate',
                        borderSpacing: 0,
                        my: 1.8,
                        fontSize: '0.85rem',
                        overflowX: 'auto',
                        display: 'block',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: 'divider'
                      },
                      '& th, & td': {
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        borderRight: '1px solid',
                        borderRightColor: 'divider',
                        p: 1,
                        textAlign: 'left'
                      },
                      '& th': {
                        backgroundColor: 'background.hover',
                        fontWeight: 600
                      },
                      '& tr:last-child td': {
                        borderBottom: 'none'
                      },
                      '& th:last-child, & td:last-child': {
                        borderRight: 'none'
                      },
                      '& blockquote': {
                        borderLeft: '3px solid',
                        borderColor: 'primary.main',
                        pl: 1.8,
                        my: 1.2,
                        color: 'text.secondary',
                        fontStyle: 'italic'
                      },
                      '& img': {
                        maxWidth: '100%',
                        borderRadius: '10px',
                        my: 1.2,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
                      }
                    }}
                  >
                    {renderedMarkdown}

                    {/* Animated three-dot typing indicator appended cleanly at end of stream */}
                    {isStreaming && (
                      <AnimatedThreeDots
                        variant="streaming"
                        size="sm"
                        aria-label="Generating response"
                      />
                    )}
                  </Box>
                )}

                {/* State D: Cancelled / Interrupted generation notice */}
                {isCancelled && !isStreaming && (
                  <Box sx={{ mt: 0.8, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <Chip
                      size="small"
                      label="Generation stopped"
                      variant="outlined"
                      sx={{
                        height: 20,
                        fontSize: '0.68rem',
                        fontWeight: 500,
                        color: 'text.secondary',
                        borderColor: 'divider',
                        backgroundColor: 'background.card'
                      }}
                    />
                  </Box>
                )}

                {/* Assistant Actions Bar (State C - visible upon completion) */}
                {!isUser && !isThinking && !isStreaming && message.content && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, pt: 0.5 }}>
                    <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                      <IconButton
                        size="small"
                        onClick={handleCopy}
                        sx={{
                          p: 0.5,
                          color: copied ? 'primary.main' : 'text.disabled',
                          '&:hover': { color: 'text.primary', backgroundColor: 'background.hover' }
                        }}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </IconButton>
                    </Tooltip>

                    {!isGenerating && (
                      <Tooltip title="Edit response">
                        <IconButton
                          size="small"
                          onClick={handleStartEdit}
                          sx={{
                            p: 0.5,
                            color: 'text.disabled',
                            '&:hover': { color: 'text.primary', backgroundColor: 'background.hover' }
                          }}
                        >
                          <Edit2 size={14} />
                        </IconButton>
                      </Tooltip>
                    )}

                    {isLatest && !isGenerating && onRegenerate && (
                      <Tooltip title="Regenerate">
                        <IconButton
                          size="small"
                          onClick={onRegenerate}
                          sx={{
                            p: 0.5,
                            color: 'text.disabled',
                            '&:hover': { color: 'text.primary', backgroundColor: 'background.hover' }
                          }}
                        >
                          <RotateCw size={14} />
                        </IconButton>
                      </Tooltip>
                    )}

                    {/* Multilingual Voice Speech Controls */}
                    {(() => {
                      const isThisSpeaking = ttsState?.activeMessageId === message.id;
                      const status = isThisSpeaking ? ttsState?.status : 'idle';
                      const detectedLang = detectLanguageFromText(message.content);
                      const effectiveLang = message.language || detectedLang || selectedLanguage || 'en';
                      const activeLangCode = isThisSpeaking ? (ttsState?.activeLang || effectiveLang) : effectiveLang;
                      const langEntry = findLanguageByCode(activeLangCode);
                      const langLabel = langEntry?.nativeLabel || 'English';
                      const speedLabel = `${playbackSpeed}×`;

                      if (status === 'loading') {
                        return (
                          <Tooltip title={`Preparing speech in ${langLabel} (${speedLabel})...`}>
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', p: 0.5 }}>
                              <CircularProgress size={13} sx={{ color: 'primary.main' }} />
                            </Box>
                          </Tooltip>
                        );
                      }

                      if (status === 'playing') {
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <Tooltip title={`Pause speech (${langLabel} at ${speedLabel})`}>
                              <IconButton
                                size="small"
                                onClick={onPauseSpeech}
                                sx={{
                                  p: 0.5,
                                  color: 'primary.main',
                                  backgroundColor: 'rgba(16, 163, 127, 0.12)',
                                  '&:hover': { color: 'primary.main', backgroundColor: 'rgba(16, 163, 127, 0.22)' }
                                }}
                              >
                                <Pause size={14} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Stop speech">
                              <IconButton
                                size="small"
                                onClick={onStopSpeech}
                                sx={{
                                  p: 0.5,
                                  color: 'text.secondary',
                                  '&:hover': { color: 'error.main', backgroundColor: 'background.hover' }
                                }}
                              >
                                <Square size={12} />
                              </IconButton>
                            </Tooltip>
                            <Chip
                              size="small"
                              icon={<Volume2 size={11} color="#10a37f" />}
                              label={`Speaking • ${langLabel} ${speedLabel}`}
                              sx={{
                                height: 20,
                                fontSize: '0.675rem',
                                fontWeight: 600,
                                backgroundColor: 'rgba(16, 163, 127, 0.12)',
                                color: '#10a37f',
                                border: '1px solid rgba(16, 163, 127, 0.25)',
                                '& .MuiChip-icon': { ml: 0.5, mr: -0.2 }
                              }}
                            />
                          </Box>
                        );
                      }

                      if (status === 'paused') {
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <Tooltip title={`Resume speech (${langLabel} at ${speedLabel})`}>
                              <IconButton
                                size="small"
                                onClick={onResumeSpeech}
                                sx={{
                                  p: 0.5,
                                  color: 'primary.main',
                                  backgroundColor: 'rgba(16, 163, 127, 0.12)',
                                  '&:hover': { color: 'primary.main', backgroundColor: 'rgba(16, 163, 127, 0.22)' }
                                }}
                              >
                                <Play size={14} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Stop speech">
                              <IconButton
                                size="small"
                                onClick={onStopSpeech}
                                sx={{
                                  p: 0.5,
                                  color: 'text.secondary',
                                  '&:hover': { color: 'error.main', backgroundColor: 'background.hover' }
                                }}
                              >
                                <Square size={12} />
                              </IconButton>
                            </Tooltip>
                            <Chip
                              size="small"
                              label={`Paused • ${langLabel} ${speedLabel}`}
                              sx={{
                                height: 20,
                                fontSize: '0.675rem',
                                fontWeight: 600,
                                backgroundColor: 'background.card',
                                color: 'text.secondary',
                                border: '1px solid',
                                borderColor: 'divider'
                              }}
                            />
                          </Box>
                        );
                      }

                      // Explicit Error State: Only shows retry if there was an actual error
                      if (status === 'error' && isThisSpeaking && ttsState?.error) {
                        return (
                          <Tooltip title={`${ttsState?.error || 'Speech failed'}. Click to retry.`}>
                            <IconButton
                              size="small"
                              onClick={() => onRetrySpeech && onRetrySpeech(message.id, message.content, effectiveLang, message.conversationId, selectedVoice)}
                              sx={{
                                p: 0.5,
                                color: 'error.main',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.2)' }
                              }}
                            >
                              <AlertCircle size={14} />
                            </IconButton>
                          </Tooltip>
                        );
                      }

                      // Normal Idle / Completed State: Resets to Start / Speaker icon, NEVER shows "Retry"
                      return (
                        <Tooltip title={`Listen in ${langLabel} (${speedLabel})`}>
                          <IconButton
                            size="small"
                            onClick={() => onPlaySpeech && onPlaySpeech(message.id, message.content, effectiveLang, message.conversationId, selectedVoice)}
                            sx={{
                              p: 0.5,
                              color: 'text.disabled',
                              '&:hover': { color: 'primary.main', backgroundColor: 'background.hover' }
                            }}
                          >
                            <Volume2 size={14} />
                          </IconButton>
                        </Tooltip>
                      );
                    })()}

                    {/* Highlights Indicator & Clear Action */}
                    {messageHighlights.length > 0 && (
                      <Tooltip title={`Clear ${messageHighlights.length} marker highlight${messageHighlights.length > 1 ? 's' : ''} on this message`}>
                        <IconButton
                          size="small"
                          onClick={() => onClearMessageHighlights && onClearMessageHighlights(message.id)}
                          sx={{
                            p: 0.5,
                            color: '#d97706',
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                            '&:hover': {
                              color: 'error.main',
                              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.1)'
                            }
                          }}
                        >
                          <Highlighter size={13} />
                        </IconButton>
                      </Tooltip>
                    )}

                    {/* Optional Diagnostic Performance Badge (TTFT & Throughput) */}
                    {(message.ttftMs || message.tokensPerSec) && !isStreaming && (
                      <Tooltip
                        title={`Time to First Token: ${message.ttftMs || 0}ms • Speed: ${message.tokensPerSec ? Math.round(message.tokensPerSec) : 0} tok/s • Duration: ${message.durationMs || 0}ms`}
                        arrow
                      >
                        <Chip
                          size="small"
                          label={`${message.ttftMs ? message.ttftMs + 'ms' : ''}${message.tokensPerSec ? ' • ' + Math.round(message.tokensPerSec) + ' t/s' : ''}`}
                          variant="outlined"
                          sx={{
                            height: 19,
                            fontSize: '0.62rem',
                            fontWeight: 500,
                            color: 'text.disabled',
                            borderColor: 'divider',
                            opacity: 0.8,
                            cursor: 'help'
                          }}
                        />
                      </Tooltip>
                    )}
                  </Box>
                )}

              </>
            )}
          </Box>

          {/* Verified Web Research Sources Card */}
          {!isUser && message.researchSources && message.researchSources.length > 0 && (
            <Box
              sx={{
                mt: 1.2,
                width: '100%',
                borderRadius: 2,
                backgroundColor: 'background.card',
                border: '1px solid',
                borderColor: 'rgba(16, 163, 127, 0.3)',
                overflow: 'hidden'
              }}
            >
              <Box
                onClick={() => setSourcesOpen(prev => !prev)}
                sx={{
                  p: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 163, 127, 0.08)' : 'rgba(16, 163, 127, 0.05)',
                  '&:hover': {
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 163, 127, 0.14)' : 'rgba(16, 163, 127, 0.09)'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Globe size={15} color="#10a37f" />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.78rem' }}>
                    Verified Web Sources ({message.researchSources.length})
                  </Typography>
                  <Chip
                    size="small"
                    icon={<ShieldCheck size={11} />}
                    label="Live Evidence"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(16, 163, 127, 0.15)',
                      color: '#10a37f',
                      border: '1px solid rgba(16, 163, 127, 0.3)'
                    }}
                  />
                </Box>
                <IconButton size="small" sx={{ p: 0.3 }}>
                  {sourcesOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </IconButton>
              </Box>

              {sourcesOpen && (
                <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {message.researchSources.map((src, sIdx) => (
                    <Box
                      key={sIdx}
                      component="a"
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        p: 1.2,
                        borderRadius: 1.5,
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.4,
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          borderColor: '#10a37f',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.825rem', color: '#10a37f', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          [{sIdx + 1}] {src.title || src.url}
                          <ExternalLink size={11} />
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          {src.publishedDate && (
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                              {src.publishedDate}
                            </Typography>
                          )}
                          <Chip
                            size="small"
                            label={src.domain || 'web'}
                            sx={{ height: 16, fontSize: '0.625rem', fontWeight: 500 }}
                          />
                        </Box>
                      </Box>
                      {src.snippet && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.35 }}>
                          {src.snippet}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* Research Warning Notice */}
          {!isUser && message.researchWarning && (
            <Alert
              severity="warning"
              icon={<AlertTriangle size={15} />}
              sx={{
                mt: 1.2,
                py: 0.5,
                px: 1.5,
                borderRadius: 2,
                fontSize: '0.78rem',
                '& .MuiAlert-message': { fontSize: '0.78rem', lineHeight: 1.4 }
              }}
            >
              <strong>Verification Limitation:</strong> {message.researchWarning}
            </Alert>
          )}

          {/* Document Intelligence Grounding Card */}
          {!isUser && message.documentSources && message.documentSources.length > 0 && (
            <Box
              sx={{
                mt: 1.2,
                width: '100%',
                borderRadius: 2,
                backgroundColor: 'background.card',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                p: 1.2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <FileText size={16} color="#3b82f6" />
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.78rem' }}>
                  Document Grounded:
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {message.documentSources.map((docName, dIdx) => (
                    <Chip
                      key={dIdx}
                      size="small"
                      label={docName}
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        backgroundColor: 'rgba(59, 130, 246, 0.12)',
                        color: '#3b82f6',
                        border: '1px solid rgba(59, 130, 246, 0.25)'
                      }}
                    />
                  ))}
                </Box>
              </Box>
              <Chip
                size="small"
                icon={<ShieldCheck size={11} />}
                label="Verified Document Citations"
                sx={{
                  height: 18,
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
              />
            </Box>
          )}

          {/* Loading indicator for follow-up suggestions */}
          {!isUser && message.loadingSuggestions && !isAnyGenerating && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                mt: 1.5,
                py: 0.5,
                px: 1.4,
                borderRadius: '16px',
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(16, 163, 127, 0.1)' : 'rgba(16, 163, 127, 0.08)',
                border: '1px dashed',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(16, 163, 127, 0.35)' : 'rgba(16, 163, 127, 0.3)',
                animation: 'pulse 1.8s infinite ease-in-out',
                '@keyframes pulse': {
                  '0%': { opacity: 0.65 },
                  '50%': { opacity: 1 },
                  '100%': { opacity: 0.65 }
                }
              }}
            >
              <CircularProgress size={12} thickness={5} sx={{ color: '#10a37f' }} />
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.6
                }}
              >
                <Sparkles size={12} color="#10a37f" />
                Generating relevant follow-ups...
              </Typography>
            </Box>
          )}

          {/* Follow-up Suggestion Chips & Cards */}
          {!isUser && !isAnyGenerating && message.suggestions && message.suggestions.length > 0 && (
            <Box
              sx={{
                mt: 2,
                pt: 1.5,
                borderTop: '1px dashed',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.25)'
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1.2,
                  flexWrap: 'wrap',
                  gap: 1
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.6
                  }}
                >
                  <Sparkles size={13} color="#10a37f" />
                  Contextual Follow-ups & Next Steps
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.68rem',
                    color: 'text.disabled',
                    display: { xs: 'none', sm: 'inline' }
                  }}
                >
                  Click to ask • Pencil icon to edit
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-start', maxWidth: '100%' }}>
                {message.suggestions.map((sug, idx) => {
                  const isObj = typeof sug === 'object' && sug !== null;
                  const title = isObj ? (sug.title || sug.prompt) : sug;
                  const promptText = isObj ? (sug.prompt || sug.title) : sug;
                  const category = isObj ? sug.category : null;
                  const isAi = isObj ? (sug.isAiGenerated !== false) : true;

                  const handleClick = () => {
                    if (onSelectSuggestion) {
                      onSelectSuggestion(promptText);
                    } else if (onSelectFollowUpSuggestion) {
                      onSelectFollowUpSuggestion(promptText);
                    }
                  };

                  const handleEdit = (e) => {
                    e.stopPropagation();
                    if (onPopulateSuggestion) {
                      onPopulateSuggestion(promptText);
                    }
                  };

                  return (
                    <Box
                      key={idx}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'stretch',
                        borderRadius: '14px',
                        border: '1px solid',
                        borderColor: (theme) =>
                          theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.24)',
                        backgroundColor: (theme) =>
                          theme.palette.mode === 'dark' ? 'rgba(19, 29, 46, 0.75)' : '#ffffff',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        overflow: 'hidden',
                        maxWidth: '100%',
                        '&:hover': {
                          borderColor: '#10a37f',
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.18)',
                          transform: 'translateY(-1px)'
                        }
                      }}
                    >
                      {/* Main Ask Button */}
                      <Button
                        size="small"
                        disabled={isAnyGenerating}
                        onClick={handleClick}
                        sx={{
                          py: 0.65,
                          px: 1.4,
                          fontSize: '0.785rem',
                          fontWeight: 500,
                          textTransform: 'none',
                          color: 'text.primary',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.9,
                          borderRadius: 0,
                          flex: 1,
                          '&:hover': {
                            backgroundColor: (theme) =>
                              theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)'
                          }
                        }}
                      >
                        {isAi ? (
                          <Sparkles size={13} color="#10a37f" style={{ flexShrink: 0 }} />
                        ) : (
                          <Compass size={13} color="#3b82f6" style={{ flexShrink: 0 }} />
                        )}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                          {category && (
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                color: isAi ? '#10a37f' : '#3b82f6',
                                lineHeight: 1.1,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                              }}
                            >
                              {category}
                            </Typography>
                          )}
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.785rem',
                              fontWeight: 550,
                              color: 'text.primary',
                              lineHeight: 1.35,
                              whiteSpace: 'normal',
                              wordBreak: 'break-word'
                            }}
                          >
                            {title}
                          </Typography>
                        </Box>
                      </Button>

                      {/* Customize / Edit Action */}
                      {onPopulateSuggestion && (
                        <Tooltip title="Customize prompt before asking" arrow>
                          <IconButton
                            size="small"
                            disabled={isAnyGenerating}
                            onClick={handleEdit}
                            sx={{
                              px: 0.9,
                              borderRadius: 0,
                              borderLeft: '1px solid',
                              borderColor: 'divider',
                              color: 'text.secondary',
                              '&:hover': {
                                color: '#10a37f',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)'
                              }
                            }}
                          >
                            <Edit3 size={13} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
