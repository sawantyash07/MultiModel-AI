import React, { useState, useEffect, useRef } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Drawer,
  Snackbar,
  Alert
} from '@mui/material';
import { getAppTheme } from './theme';
import { api } from './services/api';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import AmbientBackground from './components/AmbientBackground';
import CommandPalette from './components/CommandPalette';
import PromptLibraryView from './components/PromptLibraryView';
import ImageStudioView from './components/ImageStudioView';
import WebSearchView from './components/WebSearchView';
import SettingsDialog from './components/SettingsDialog';
import MemoryDialog from './components/MemoryDialog';
import ModelHubView from './components/ModelHub/ModelHubView';
import KnowledgeGraphView from './components/KnowledgeGraph/KnowledgeGraphView';
import DownloadChatDialog from './components/DownloadChatDialog';
import { useTtsAudio } from './services/useTtsAudio';
import { isMatchingScript } from './services/languageRegistry';
import { mergeAndSegmentHighlights } from './services/textAnnotationEngine';

export default function App() {
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('yash_ai_theme') || 'light';
  });

  const {
    selectedLanguage,
    setSelectedLanguage,
    selectedVoice,
    setSelectedVoice,
    playbackSpeed,
    setPlaybackSpeed,
    autoPlaySpeech,
    setAutoPlaySpeech,
    ttsState,
    play: playSpeech,
    pause: pauseSpeech,
    resume: resumeSpeech,
    stop: stopSpeech,
    retry: retrySpeech,
    seekToWord,
    feedStreamingText,
    finishStreamingSpeech
  } = useTtsAudio();

  // Navigation Views: 'chat' | 'hub' | 'prompts' | 'image-gen' | 'web-search' | 'graph'
  const [currentView, setCurrentView] = useState('chat');
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('gemini-2.5-flash');
  const [isGenerating, setIsGenerating] = useState(false);

  // Layout UI states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [sidebarExportConv, setSidebarExportConv] = useState(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  const abortControllerRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const activeSuggestionReqIdRef = useRef(0);
  const currentRequestIdRef = useRef(null);
  const currentMessageIdRef = useRef(null);

  const theme = getAppTheme(themeMode);

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    localStorage.setItem('yash_ai_theme', next);
  };

  const showToast = (message, severity = 'info') => {
    setToast({ open: true, message, severity });
  };

  // Global Keyboard Shortcuts (Ctrl+K / Cmd+K, Ctrl+N / Cmd+N)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K: Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      // Ctrl+N or Cmd+N: New Chat (when not in an input/textarea)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          handleNewChat();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initial Load
  useEffect(() => {
    loadConversations();
    loadMemoryCount();
  }, []);

  const loadMemoryCount = async () => {
    try {
      const data = await api.getMemories();
      const list = data?.memories || [];
      setMemoryCount(list.length);
    } catch (_) {}
  };

  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      const convList = Array.isArray(data) ? data : (data.conversations || []);
      setConversations(convList);
      const savedConvId = localStorage.getItem('yash_ai_active_conv_id');
      if (savedConvId && convList.some(c => c.id === savedConvId) && !currentConversationId) {
        handleSelectConversation(savedConvId);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  // Handle Switching Conversations
  const handleSelectConversation = async (id) => {
    if (isGenerating) return;
    activeSuggestionReqIdRef.current++;
    stopSpeech();
    setCurrentView('chat');
    try {
      const conv = await api.getConversation(id);
      if (conv) {
        setCurrentConversationId(conv.id);
        try {
          localStorage.setItem('yash_ai_active_conv_id', conv.id);
        } catch (_) {}
        setMessages(conv.messages || []);
        if (Array.isArray(conv.highlights)) {
          setHighlights(conv.highlights);
        } else {
          try {
            const hlData = await api.getHighlights(conv.id);
            setHighlights(hlData?.highlights || []);
          } catch (_) {
            setHighlights([]);
          }
        }
        if (conv.modelId && conv.modelId !== 'auto') {
          setSelectedModelId(conv.modelId);
        }
        setMobileSidebarOpen(false);
      }
    } catch (err) {
      showToast('Failed to load conversation', 'error');
    }
  };

  // Start a Fresh New Chat
  const handleNewChat = () => {
    if (isGenerating) return;
    activeSuggestionReqIdRef.current++;
    stopSpeech();
    setCurrentView('chat');
    setCurrentConversationId(null);
    try {
      localStorage.removeItem('yash_ai_active_conv_id');
    } catch (_) {}
    setMessages([]);
    setHighlights([]);
    setMobileSidebarOpen(false);
  };

  // Send Message & Stream
  const handleSendMessage = async (promptText, attachments = [], options = {}, customHistory = null) => {
    const hasPrompt = promptText && promptText.trim().length > 0;
    const hasAttachments = attachments && attachments.length > 0;

    if (isGenerating || isSubmittingRef.current || (!hasPrompt && !hasAttachments)) return;
    stopSpeech();
    isSubmittingRef.current = true;

    const opts = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
    const effectiveHistory = Array.isArray(options) ? options : customHistory;
    const effectiveModelId = opts.modelId || selectedModelId;
    const effectiveAllowFallback = opts.allowFallback !== undefined
      ? Boolean(opts.allowFallback)
      : (localStorage.getItem('yash_image_auto_fallback') === 'true');

    const effectivePrompt = hasPrompt
      ? promptText.trim()
      : (hasAttachments ? 'Describe this image or document in detail and extract key information.' : '');

    let convId = currentConversationId;

    // 1. If no active conversation, create one on server first with firstPrompt for automatic titling
    if (!convId) {
      try {
        const created = await api.createConversation({
          modelId: effectiveModelId,
          firstPrompt: effectivePrompt
        });
        convId = created.id;
        setCurrentConversationId(convId);
        try {
          localStorage.setItem('yash_ai_active_conv_id', convId);
        } catch (_) {}
        loadConversations();
      } catch (err) {
        convId = `conv-${Date.now()}`;
        setCurrentConversationId(convId);
        try {
          localStorage.setItem('yash_ai_active_conv_id', convId);
        } catch (_) {}
      }
    }

    // 2. Determine base messages
    const base = effectiveHistory !== null && effectiveHistory !== undefined ? effectiveHistory : messages;

    // 3. Append user message to UI
    const userMsg = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: effectivePrompt,
      attachments: attachments || [],
      language: selectedLanguage,
      createdAt: new Date().toISOString()
    };

    const updatedMessages = [...base, userMsg];
    setMessages(updatedMessages);
    setIsGenerating(true);

    // 4. Prepare placeholder assistant message with unique request & message correlation
    const assistantMsgId = `msg-${Date.now()}-assistant`;
    const currentRequestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    currentRequestIdRef.current = currentRequestId;
    currentMessageIdRef.current = assistantMsgId;

    const assistantPlaceholder = {
      id: assistantMsgId,
      requestId: currentRequestId,
      role: 'assistant',
      content: '',
      modelId: effectiveModelId,
      language: selectedLanguage,
      status: 'thinking',
      isGenerating: true,
      loadingSuggestions: false,
      suggestions: [],
      createdAt: new Date().toISOString()
    };

    setMessages([...updatedMessages, assistantPlaceholder]);

    // Setup abort controller
    abortControllerRef.current = new AbortController();

    let fullAnswer = '';
    let responseMetadata = null;
    let streamFailed = false;

    await api.streamChat({
      conversationId: convId,
      modelId: effectiveModelId,
      language: selectedLanguage,
      webSearch: opts.webSearch !== undefined ? opts.webSearch : null,
      allowFallback: effectiveAllowFallback,
      messages: updatedMessages,
      attachments,
      requestId: currentRequestId,
      messageId: assistantMsgId,
      signal: abortControllerRef.current.signal,
      onStart: (startMeta) => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          status: 'thinking',
          isThinking: true,
          modelId: startMeta.modelId || m.modelId,
          modelName: startMeta.modelName || m.modelName,
          provider: startMeta.provider || m.provider
        } : m));
      },
      onThinking: () => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          status: 'thinking',
          isThinking: true
        } : m));
      },
      onToken: (token) => {
        fullAnswer += token;
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          content: fullAnswer,
          status: 'streaming',
          isThinking: false,
          error: null
        } : m));

        // Incremental streaming speech when Auto Speak is ON
        if (autoPlaySpeech) {
          if (selectedLanguage === 'en' || isMatchingScript(fullAnswer, selectedLanguage)) {
            feedStreamingText(assistantMsgId, fullAnswer, convId, selectedLanguage);
          }
        }
      },
      onMetadata: (meta) => {
        responseMetadata = meta;
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          modelId: meta.modelId || m.modelId,
          modelName: meta.modelName || m.modelName,
          provider: meta.provider || m.provider,
          providerId: meta.providerId || m.providerId,
          durationMs: meta.durationMs || m.durationMs,
          ttftMs: meta.ttftMs || meta.firstTokenTimeMs || m.ttftMs,
          tokensPerSec: meta.tokensPerSec || meta.tokenSpeed || m.tokensPerSec,
          language: meta.language || selectedLanguage
        } : m));
      },
      onUsage: (usage) => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          ttftMs: usage.ttftMs || usage.firstTokenTimeMs || m.ttftMs,
          tokensPerSec: usage.tokensPerSec || usage.tokenSpeed || m.tokensPerSec,
          tokenCount: usage.tokenCount || usage.completionTokens || m.tokenCount,
          durationMs: usage.totalDurationMs || usage.durationMs || m.durationMs
        } : m));
      },
      onCancelled: () => {
        setIsGenerating(false);
        isSubmittingRef.current = false;
        currentRequestIdRef.current = null;
        currentMessageIdRef.current = null;
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          status: 'cancelled',
          isCancelled: true,
          isGenerating: false,
          interrupted: true,
          content: fullAnswer
        } : m));
      },
      onAutoSelected: (autoModel) => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, modelId: autoModel } : m));
      },
      onMemory: (data) => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          memoriesUsed: data.memories || []
        } : m));
      },
      onResearch: (data) => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          researchSources: data.sources || [],
          researchWarning: data.warning || null,
          researchVerified: data.verified
        } : m));
      },
      onImage: (imgData) => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          generatedImage: imgData
        } : m));
      },
      onDocument: (data) => {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          documentSources: data.documents || []
        } : m));
      },
      onDone: async (doneMeta) => {
        setIsGenerating(false);
        isSubmittingRef.current = false;
        currentRequestIdRef.current = null;
        currentMessageIdRef.current = null;
        if (streamFailed) return;

        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          status: 'complete',
          isGenerating: false,
          content: fullAnswer,
          ttftMs: doneMeta?.ttftMs || doneMeta?.firstTokenTimeMs || m.ttftMs,
          tokensPerSec: doneMeta?.tokensPerSec || doneMeta?.tokenSpeed || m.tokensPerSec,
          durationMs: doneMeta?.durationMs || doneMeta?.totalDurationMs || m.durationMs
        } : m));

        loadMemoryCount();

        // Target Language Verification & Fallback Translation
        if (selectedLanguage && selectedLanguage !== 'en' && fullAnswer && fullAnswer.trim()) {
          const matchesTargetScript = isMatchingScript(fullAnswer, selectedLanguage);
          if (!matchesTargetScript) {
            try {
              const transResult = await api.translateText({
                text: fullAnswer,
                targetLanguage: selectedLanguage,
                sourceLanguage: 'en'
              });
              if (transResult && transResult.translatedText && transResult.translatedText.trim()) {
                fullAnswer = transResult.translatedText.trim();
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                  ...m,
                  content: fullAnswer,
                  language: selectedLanguage
                } : m));
                if (convId) {
                  try {
                    await api.updateMessage(convId, assistantMsgId, fullAnswer);
                  } catch (e) {
                    console.warn('[Translate] Could not persist translated message:', e);
                  }
                }
              }
            } catch (transErr) {
              console.warn('[Translate] Fallback translation failed:', transErr);
            }
          }
        }

        // Dynamic follow-up suggestions with concurrency guard
        if (fullAnswer && fullAnswer.trim()) {
          const currentReqId = ++activeSuggestionReqIdRef.current;
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, loadingSuggestions: true } : m));

          try {
            const sugData = await api.getSuggestions(
              effectivePrompt,
              fullAnswer,
              updatedMessages,
              selectedModelId,
              selectedLanguage,
              attachments
            );

            // Ignore if newer suggestion request or chat switch occurred
            if (currentReqId !== activeSuggestionReqIdRef.current) {
              return;
            }

            if (sugData?.suggestions?.length > 0) {
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                ...m,
                suggestions: sugData.suggestions,
                suggestionTopic: sugData.topic,
                isAiGenerated: sugData.isAiGenerated,
                loadingSuggestions: false
              } : m));
            } else {
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, loadingSuggestions: false } : m));
            }
          } catch (err) {
            if (currentReqId === activeSuggestionReqIdRef.current) {
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, loadingSuggestions: false } : m));
            }
          }
        }

        loadConversations();

        if (autoPlaySpeech && fullAnswer && fullAnswer.trim()) {
          finishStreamingSpeech(assistantMsgId, fullAnswer, convId, selectedLanguage);
        }
      },
      onError: (err) => {
        streamFailed = true;
        setIsGenerating(false);
        isSubmittingRef.current = false;
        currentRequestIdRef.current = null;
        currentMessageIdRef.current = null;
        showToast(err.message || 'Generation error', 'error');
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          status: 'error',
          error: err.message,
          content: fullAnswer,
          isGenerating: false,
          loadingSuggestions: false
        } : m));
      }
    });
  };

  // Stop Generation
  const handleStopGeneration = () => {
    stopSpeech();
    const activeReqId = currentRequestIdRef.current;
    const activeMsgId = currentMessageIdRef.current;
    const activeConvId = currentConversationId;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (activeReqId || activeConvId) {
      api.stopChatStream({
        conversationId: activeConvId,
        requestId: activeReqId,
        messageId: activeMsgId
      }).catch(err => console.warn('[Stop] Backend stop error:', err));
    }

    isSubmittingRef.current = false;
    setIsGenerating(false);
    currentRequestIdRef.current = null;
    currentMessageIdRef.current = null;

    if (activeMsgId) {
      setMessages(prev => prev.map(m => m.id === activeMsgId ? {
        ...m,
        status: 'cancelled',
        isCancelled: true,
        isGenerating: false,
        interrupted: true
      } : m));
    }

    showToast('Generation stopped', 'info');
  };

  // Edit User Message
  const handleEditUserMessage = async (messageId, newContent) => {
    if (isGenerating) return;
    const userIndex = messages.findIndex(m => m.id === messageId);
    if (userIndex === -1) return;

    const targetMsg = messages[userIndex];
    const historyBefore = messages.slice(0, userIndex);

    // Prune highlights for invalidated/replaced messages
    const prunedMsgIds = messages.slice(userIndex).map(m => m.id);
    setHighlights(prev => prev.filter(h => !prunedMsgIds.includes(h.messageId)));

    if (currentConversationId) {
      try {
        await api.replaceMessages(currentConversationId, historyBefore);
      } catch (err) {
        console.warn('Failed to prune backend messages before edit:', err);
      }
    }

    handleSendMessage(newContent, targetMsg.attachments || [], historyBefore);
  };

  // Edit Assistant Message
  const handleEditAssistantMessage = async (messageId, newContent) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent } : m));
    // Remove highlights whose text is no longer present in edited message
    setHighlights(prev => prev.filter(h => {
      if (h.messageId !== messageId) return true;
      return newContent.includes(h.text);
    }));

    if (currentConversationId) {
      try {
        await api.updateMessage(currentConversationId, messageId, newContent);
        showToast('Message updated', 'success');
      } catch (err) {
        showToast('Failed to save message edit', 'error');
      }
    }
  };

  // Regenerate Response
  const handleRegenerate = async () => {
    if (isGenerating || messages.length < 2) return;
    const lastUserIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserIndex === -1) return;

    const userMsg = messages[lastUserIndex];
    const historyBefore = messages.slice(0, lastUserIndex);

    // Prune highlights for replaced assistant messages
    const prunedMsgIds = messages.slice(lastUserIndex + 1).map(m => m.id);
    setHighlights(prev => prev.filter(h => !prunedMsgIds.includes(h.messageId)));

    if (currentConversationId) {
      try {
        await api.replaceMessages(currentConversationId, historyBefore);
      } catch (err) {
        console.warn('Failed to prune backend messages before regenerate:', err);
      }
    }

    handleSendMessage(userMsg.content, userMsg.attachments || [], historyBefore);
  };

  // Regenerate with a Specific Fallback Model
  const handleRegenerateWithModel = async (fallbackModelId) => {
    if (isGenerating || messages.length < 2) return;
    const targetModel = fallbackModelId || 'flux-schnell-free';
    setSelectedModelId(targetModel);

    const lastUserIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserIndex === -1) return;

    const userMsg = messages[lastUserIndex];
    const historyBefore = messages.slice(0, lastUserIndex);

    if (currentConversationId) {
      try {
        await api.replaceMessages(currentConversationId, historyBefore);
      } catch (err) {
        console.warn('Failed to prune backend messages before fallback regenerate:', err);
      }
    }

    handleSendMessage(userMsg.content, userMsg.attachments || [], { modelId: targetModel, allowFallback: true }, historyBefore);
  };

  // Rename Conversation
  const handleRenameConversation = async (id, title) => {
    try {
      await api.renameConversation(id, title);
      showToast('Conversation renamed');
      loadConversations();
    } catch (err) {
      showToast('Failed to rename conversation', 'error');
    }
  };

  // Delete Conversation
  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      showToast('Conversation deleted');
      if (currentConversationId === id) {
        handleNewChat();
      }
      loadConversations();
    } catch (err) {
      showToast('Failed to delete conversation', 'error');
    }
  };

  // Clear All Conversations
  const handleClearAllConversations = async () => {
    try {
      await api.clearConversations();
      showToast('All conversation history cleared');
      handleNewChat();
      loadConversations();
    } catch (err) {
      showToast('Failed to clear conversations', 'error');
    }
  };

  // Save or update custom RGB marker highlight
  const handleSaveHighlight = async (hl) => {
    if (!hl) return;
    const convId = currentConversationId || hl.conversationId;
    if (!convId) return;

    const normalizedHl = {
      ...hl,
      conversationId: convId
    };

    setHighlights(prev => {
      const msgHighlights = prev.filter(h => h.messageId === normalizedHl.messageId);
      const otherHighlights = prev.filter(h => h.messageId !== normalizedHl.messageId);
      const merged = mergeAndSegmentHighlights(msgHighlights, normalizedHl);
      return [...otherHighlights, ...merged];
    });

    try {
      await api.saveHighlight(convId, normalizedHl);
    } catch (err) {
      console.error('Failed to persist highlight:', err);
    }
  };

  // Delete individual highlight
  const handleDeleteHighlight = async (convId, hlId) => {
    if (!hlId) return;
    const targetConvId = convId || currentConversationId;
    setHighlights(prev => prev.filter(h => h.id !== hlId));
    if (targetConvId) {
      try {
        await api.deleteHighlight(targetConvId, hlId);
      } catch (err) {
        console.error('Failed to delete highlight on server:', err);
      }
    }
  };

  // Clear highlights
  const handleClearHighlights = async (convId, messageId = null) => {
    const targetConvId = convId || currentConversationId;
    if (!targetConvId) return;

    if (messageId) {
      setHighlights(prev => prev.filter(h => h.messageId !== messageId));
    } else {
      setHighlights([]);
    }

    try {
      await api.clearHighlights(targetConvId, messageId);
      showToast(messageId ? 'Message highlights cleared' : 'Conversation highlights cleared');
    } catch (err) {
      console.error('Failed to clear highlights on server:', err);
    }
  };

  // Current active conversation object
  const currentConv = conversations.find(c => c.id === currentConversationId) || {
    id: currentConversationId,
    title: 'New Conversation'
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
        {/* Animated Emerald Background */}
        <AmbientBackground themeMode={themeMode} />

        {/* 1. Desktop Unified Navigation Sidebar (Expanded: 260px, Collapsed: 68px) */}
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            height: '100%',
            zIndex: 21,
            flexShrink: 0
          }}
        >
          <Sidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            onRenameConversation={handleRenameConversation}
            onDeleteConversation={handleDeleteConversation}
            onExportConversation={(conv) => setSidebarExportConv(conv)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenMemory={() => setMemoryDialogOpen(true)}
            memoryCount={memoryCount}
            themeMode={themeMode}
            onToggleTheme={toggleTheme}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            currentView={currentView}
            onSelectView={setCurrentView}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />
        </Box>

        {/* 2. Mobile Slide-Out Drawer Sidebar */}
        <Drawer
          anchor="left"
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          sx={{ display: { xs: 'block', md: 'none' } }}
        >
          <Box sx={{ width: 280, height: '100%' }}>
            <Sidebar
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={handleSelectConversation}
              onNewChat={handleNewChat}
              onRenameConversation={handleRenameConversation}
              onDeleteConversation={handleDeleteConversation}
              onExportConversation={(conv) => {
                setMobileSidebarOpen(false);
                setSidebarExportConv(conv);
              }}
              onOpenSettings={() => {
                setMobileSidebarOpen(false);
                setSettingsOpen(true);
              }}
              onOpenMemory={() => {
                setMobileSidebarOpen(false);
                setMemoryDialogOpen(true);
              }}
              memoryCount={memoryCount}
              themeMode={themeMode}
              onToggleTheme={toggleTheme}
              collapsed={false}
              onToggleCollapse={() => setMobileSidebarOpen(false)}
              currentView={currentView}
              onSelectView={(view) => {
                setMobileSidebarOpen(false);
                setCurrentView(view);
              }}
              onOpenCommandPalette={() => {
                setMobileSidebarOpen(false);
                setCommandPaletteOpen(true);
              }}
            />
          </Box>
        </Drawer>

        {/* 4. Main Workspace Content Area */}
        <Box sx={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
          {currentView === 'hub' ? (
            <ModelHubView
              onShowToast={showToast}
              onBackToChat={() => setCurrentView('chat')}
            />
          ) : currentView === 'prompts' ? (
            <PromptLibraryView
              onUsePrompt={(promptText) => {
                setCurrentView('chat');
                handleSendMessage(promptText);
              }}
              onBackToChat={() => setCurrentView('chat')}
            />
          ) : currentView === 'image-gen' ? (
            <ImageStudioView
              onSendToChat={(url, promptText) => {
                setCurrentView('chat');
                handleSendMessage(promptText, [{
                  name: 'generated_flux_artwork.jpg',
                  dataUrl: url,
                  isImage: true,
                  size: 500000,
                  formattedSize: '500 KB'
                }]);
              }}
              onShowToast={showToast}
            />
          ) : currentView === 'web-search' ? (
            <WebSearchView
              onSendToChat={(text) => {
                setCurrentView('chat');
                handleSendMessage(text);
              }}
              onShowToast={showToast}
            />
          ) : currentView === 'graph' ? (
            <KnowledgeGraphView
              themeMode={themeMode}
              onShowToast={showToast}
              onOpenConversation={(id) => handleSelectConversation(id)}
              onOpenMemory={() => setMemoryDialogOpen(true)}
            />
          ) : (
            <ChatArea
              conversation={currentConv}
              messages={messages}
              isGenerating={isGenerating}
              selectedModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
              onSendMessage={handleSendMessage}
              onStopGeneration={handleStopGeneration}
              onRegenerate={handleRegenerate}
              onRegenerateWithModel={handleRegenerateWithModel}
              onEditUserMessage={handleEditUserMessage}
              onEditAssistantMessage={handleEditAssistantMessage}
              onOpenModelHub={() => setCurrentView('hub')}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenMemory={() => setMemoryDialogOpen(true)}
              onClearCurrentChat={() => {
                if (currentConversationId) {
                  handleDeleteConversation(currentConversationId);
                } else {
                  setMessages([]);
                }
              }}
              onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebarCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              onOpenWebSearch={() => setCurrentView('web-search')}
              onOpenImageStudio={() => setCurrentView('image-gen')}
              onOpenKnowledgeGraph={() => setCurrentView('graph')}
              selectedLanguage={selectedLanguage}
              onSelectLanguage={setSelectedLanguage}
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoice}
              playbackSpeed={playbackSpeed}
              onSelectSpeed={setPlaybackSpeed}
              autoPlaySpeech={autoPlaySpeech}
              onToggleAutoPlay={() => setAutoPlaySpeech(prev => !prev)}
              ttsState={ttsState}
              onPlaySpeech={playSpeech}
              onPauseSpeech={pauseSpeech}
              onResumeSpeech={resumeSpeech}
              onStopSpeech={stopSpeech}
              onRetrySpeech={retrySpeech}
              onSeekToWord={seekToWord}
              highlights={highlights}
              onSaveHighlight={handleSaveHighlight}
              onDeleteHighlight={handleDeleteHighlight}
              onClearHighlights={handleClearHighlights}
              themeMode={themeMode}
            />
          )}
        </Box>

        {/* Command Palette Modal (Ctrl + K) */}
        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onNewChat={handleNewChat}
          onSelectView={(v) => {
            setCurrentView(v);
            setCommandPaletteOpen(false);
          }}
          onSelectModel={(m) => {
            setSelectedModelId(m);
            showToast(`Model switched to ${m}`, 'info');
          }}
          selectedModelId={selectedModelId}
          autoPlaySpeech={autoPlaySpeech}
          onToggleAutoPlay={() => setAutoPlaySpeech((prev) => !prev)}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => {
            setCommandPaletteOpen(false);
            setSettingsOpen(true);
          }}
          onOpenMemory={() => {
            setCommandPaletteOpen(false);
            setMemoryDialogOpen(true);
          }}
          onTriggerUpload={() => {
            setCommandPaletteOpen(false);
            showToast('Attach your document or screenshot using the clip icon or drag-and-drop', 'info');
          }}
          conversations={conversations}
          onSelectConversation={(id) => {
            setCommandPaletteOpen(false);
            handleSelectConversation(id);
          }}
        />

        {/* Settings Dialog */}
        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          onClearAllConversations={handleClearAllConversations}
          onOpenMemory={() => {
            setSettingsOpen(false);
            setMemoryDialogOpen(true);
          }}
        />

        {/* Persistent AI Memory Dialog */}
        <MemoryDialog
          open={memoryDialogOpen}
          onClose={() => setMemoryDialogOpen(false)}
          onMemoryCountChange={setMemoryCount}
        />

        {/* Sidebar Export Conversation Dialog */}
        {sidebarExportConv && (
          <DownloadChatDialog
            open={Boolean(sidebarExportConv)}
            onClose={() => setSidebarExportConv(null)}
            conversation={sidebarExportConv}
            messages={sidebarExportConv.id === currentConversationId ? messages : []}
            highlights={sidebarExportConv.id === currentConversationId ? highlights : []}
            isGenerating={isGenerating && sidebarExportConv.id === currentConversationId}
          />
        )}

        {/* Notification Toast */}
        <Snackbar
          open={toast.open}
          autoHideDuration={3500}
          onClose={() => setToast({ ...toast, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setToast({ ...toast, open: false })}
            severity={toast.severity}
            sx={{ width: '100%', borderRadius: 2 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
