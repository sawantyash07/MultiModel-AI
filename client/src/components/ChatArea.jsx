import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Card,
  CardActionArea,
  Chip,
  Menu,
  MenuItem,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar
} from '@mui/material';
import {
  Menu as MenuIcon,
  Sparkles,
  Code2,
  Brain,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  ArrowRight,
  Zap,
  Globe,
  Languages,
  Mic,
  GraduationCap,
  Volume2,
  VolumeX,
  Highlighter,
  Command,
  Settings,
  MoreVertical,
  Download,
  Trash2,
  Network,
  Cpu,
  Edit3,
  Compass,
  PanelLeft,
  Search
} from 'lucide-react';
import MessageItem from './MessageItem';
import MessageComposer from './MessageComposer';
import ModelSelector from './ModelSelector';
import PineconeStatusPill from './PineconeStatusPill';
import LanguageSelectorBar from './LanguageSelectorBar';
import HighlighterControlBar, { PRIMARY_RGB_COLORS } from './HighlighterControlBar';
import TextHighlightToolbar from './TextHighlightToolbar';
import DownloadChatDialog from './DownloadChatDialog';
import { detectLanguageFromText } from '../services/languageRegistry';
import { api } from '../services/api';

// 5 Capability Badges
const CAPABILITY_BADGES = [
  { label: 'Fast & Reliable', icon: Zap },
  { label: 'Multi-Modal', icon: Sparkles },
  { label: '10+ Indian Languages', icon: Languages },
  { label: 'Voice Enabled', icon: Mic },
  { label: 'Study & Dev Partner', icon: GraduationCap }
];

const ICON_MAP = {
  'code': Code2,
  'brain': Brain,
  'image': ImageIcon,
  'file-text': FileText,
  'file': FileText,
  'check-circle': CheckCircle2,
  'check': CheckCircle2,
  'languages': Languages,
  'cpu': Cpu,
  'sparkles': Sparkles,
  'compass': Compass
};

// 5 Default Feature Cards (each tied to a concrete action)
const DEFAULT_FEATURE_CARDS = [
  {
    id: 'code-debug',
    title: 'Code & Debug',
    icon: Code2,
    iconColor: '#3b82f6',
    iconBg: 'rgba(59, 130, 246, 0.12)',
    description: 'Generate algorithms, debug syntax errors, optimize queries, and master DSA.',
    prompt: 'Solve a DSA problem in Java: Implement an optimized LRU Cache with O(1) get and put operations, including full comments and unit test cases.'
  },
  {
    id: 'explain-concepts',
    title: 'Explain Concepts',
    icon: Brain,
    iconColor: '#8b5cf6',
    iconBg: 'rgba(139, 92, 246, 0.12)',
    description: 'Break down complex engineering, science, and AI topics with lucid intuition.',
    prompt: 'Explain the working principles, actuation mechanisms, and biomedical applications of a MEMS micropump. Include a clear ASCII architecture diagram.'
  },
  {
    id: 'generate-images',
    title: 'Generate Images',
    icon: ImageIcon,
    iconColor: '#ec4899',
    iconBg: 'rgba(236, 72, 153, 0.12)',
    description: 'Synthesize photorealistic concept art, diagrams, and 3D renders with FLUX.',
    prompt: 'Generate a 3D photorealistic robotic manipulator arm with carbon-fiber chassis and glowing emerald status joints in an engineering cleanroom.'
  },
  {
    id: 'analyze-documents',
    title: 'Analyze Documents',
    icon: FileText,
    iconColor: '#f59e0b',
    iconBg: 'rgba(245, 158, 11, 0.12)',
    description: 'Parse PDFs, spreadsheets, and technical docs with citation-backed QA.',
    prompt: 'Summarize this document into structured takeaways: 1. Core Problem, 2. Key Breakthroughs, 3. Empirical Results, 4. Limitations.'
  },
  {
    id: 'plan-productive',
    title: 'Plan & Be Productive',
    icon: CheckCircle2,
    iconColor: '#10b981',
    iconBg: 'rgba(16, 185, 129, 0.12)',
    description: 'Draft architecture roadmaps, organize study schedules, and structure workflows.',
    prompt: 'Create an intensive 30-day mastery schedule for Computer Science engineering exams (OS, DBMS, Networks, and DSA) with spaced repetition.'
  }
];

// Clickable suggestion chips
const DEFAULT_SUGGESTION_CHIPS = [
  { label: 'Explain MEMS micropump with diagram', prompt: 'Explain the working principles of a MEMS micropump with an ASCII diagram of chambers, check valves, and diaphragm displacement.' },
  { label: 'Solve a DSA problem in Java', prompt: 'Solve the Word Ladder problem in Java using Bidirectional BFS with detailed time and space complexity analysis.' },
  { label: 'Generate a 3D robot arm image', prompt: 'Generate a 3D photorealistic robotic manipulator arm with carbon fiber joints and glowing emerald rings in a cleanroom, 8k render.' },
  { label: 'Summarize a technical document', prompt: 'Please summarize this technical document into an executive summary, key technical contributions, benchmarks, and actionable insights.' },
  { label: 'Latest AI news & research', prompt: 'Search the live web for the latest artificial intelligence news, model releases, and research breakthroughs from this week with citations.' }
];

export default function ChatArea({
  conversation,
  messages = [],
  isGenerating = false,
  selectedModelId = 'gemini-2.5-flash',
  onSelectModel,
  onSendMessage,
  onStopGeneration,
  onRegenerate,
  onRegenerateWithModel,
  onClearCurrentChat,
  onToggleMobileSidebar,
  sidebarCollapsed = false,
  onToggleSidebarCollapse,
  onEditUserMessage,
  onEditAssistantMessage,
  onOpenModelHub,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenMemory,
  onOpenWebSearch,
  onOpenImageStudio,
  onOpenKnowledgeGraph,
  selectedLanguage = 'en',
  onSelectLanguage,
  selectedVoice = 'default',
  onSelectVoice,
  playbackSpeed = 1.0,
  onSelectSpeed,
  autoPlaySpeech = false,
  onToggleAutoPlay,
  ttsState,
  onPlaySpeech,
  onPauseSpeech,
  onResumeSpeech,
  onStopSpeech,
  onRetrySpeech,
  onSeekToWord,
  highlights = [],
  onSaveHighlight,
  onDeleteHighlight,
  onClearHighlights,
  themeMode = 'light'
}) {
  const scrollEndRef = useRef(null);
  const composerRef = useRef(null);
  const isDark = themeMode === 'dark';

  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
  const actionsMenuOpen = Boolean(actionsMenuAnchor);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // Dynamic Suggestion Cards, Chips, and Composer Preset State
  const [featureCards, setFeatureCards] = useState(DEFAULT_FEATURE_CARDS);
  const [suggestionChips, setSuggestionChips] = useState(DEFAULT_SUGGESTION_CHIPS);
  const [composerPresetPrompt, setComposerPresetPrompt] = useState(null);
  const [composerPresetAttachment, setComposerPresetAttachment] = useState(null);

  const handleRefineImage = (imageDataUrl, previousPrompt) => {
    setComposerPresetAttachment({
      id: `ref-${Date.now()}`,
      name: 'reference-image.jpg',
      type: 'image/jpeg',
      dataUrl: imageDataUrl,
      size: 1024,
      category: 'image'
    });
    setComposerPresetPrompt('Modify this image: preserve the subject, but ');
  };

  // Dynamically load personalized cards and chips from user history & interests
  useEffect(() => {
    let isMounted = true;
    api.getPersonalizedSuggestions()
      .then((data) => {
        if (!isMounted) return;
        if (data?.cards?.length > 0) {
          setFeatureCards(
            data.cards.map((c) => ({
              ...c,
              icon: ICON_MAP[c.icon] || Code2
            }))
          );
        }
        if (data?.chips?.length > 0) {
          setSuggestionChips(data.chips);
        }
      })
      .catch((err) => {
        console.warn('[ChatArea] Error loading personalized suggestions:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [conversation?.id, messages.length === 0]);

  // Independent Text Highlighter Mode & Color States
  const [isHighlightMode, setIsHighlightMode] = useState(() => {
    try {
      return localStorage.getItem('yash_ai_highlight_mode') === 'true';
    } catch (_) {
      return false;
    }
  });

  const [highlightColorKey, setHighlightColorKey] = useState(() => {
    try {
      return localStorage.getItem('yash_ai_highlight_color') || 'green';
    } catch (_) {
      return 'green';
    }
  });

  const [highlightOpacity, setHighlightOpacity] = useState(0.28);
  const [activeSelection, setActiveSelection] = useState(null);
  const [editingHighlight, setEditingHighlight] = useState(null);

  useEffect(() => {
    setActiveSelection(null);
    setEditingHighlight(null);
  }, [conversation?.id]);

  const handleToggleHighlightMode = () => {
    setIsHighlightMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('yash_ai_highlight_mode', String(next));
      } catch (_) {}
      if (!next) {
        setActiveSelection(null);
        setEditingHighlight(null);
      }
      return next;
    });
  };

  const handleTurnOffHighlightMode = () => {
    setIsHighlightMode(false);
    try {
      localStorage.setItem('yash_ai_highlight_mode', 'false');
    } catch (_) {}
    setActiveSelection(null);
    setEditingHighlight(null);
  };

  const handleSelectColorKey = (key) => {
    setHighlightColorKey(key);
    try {
      localStorage.setItem('yash_ai_highlight_color', key);
    } catch (_) {}
  };

  const handleSelectHighlightText = (selData) => {
    if (!isHighlightMode) return;
    setEditingHighlight(null);
    setActiveSelection(selData);
  };

  const handleEditHighlight = (hl, rect) => {
    setActiveSelection(null);
    setEditingHighlight({ highlight: hl, rect });
  };

  const activeColorObj = PRIMARY_RGB_COLORS.find((c) => c.key === highlightColorKey) || PRIMARY_RGB_COLORS[1];

  const handleApplyHighlightFromToolbar = (colorInfo) => {
    const colorStr = typeof colorInfo === 'string'
      ? colorInfo
      : (colorInfo?.color || activeColorObj.getRgba(highlightOpacity));
    const colorKey = typeof colorInfo === 'object' && colorInfo?.colorKey
      ? colorInfo.colorKey
      : highlightColorKey;

    if (editingHighlight) {
      const updated = {
        ...editingHighlight.highlight,
        color: colorStr,
        colorKey,
        updatedAt: new Date().toISOString()
      };
      onSaveHighlight && onSaveHighlight(updated);
      setEditingHighlight(null);
      return;
    }

    if (activeSelection) {
      const newHighlight = {
        id: `hl-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        conversationId: activeSelection.conversationId || conversation?.id,
        messageId: activeSelection.messageId,
        text: activeSelection.text,
        startOffset: activeSelection.startOffset,
        endOffset: activeSelection.endOffset,
        prefix: activeSelection.prefix,
        suffix: activeSelection.suffix,
        color: colorStr,
        colorKey,
        createdAt: new Date().toISOString()
      };
      onSaveHighlight && onSaveHighlight(newHighlight);
      setActiveSelection(null);
      try {
        window.getSelection()?.removeAllRanges();
      } catch (_) {}
    }
  };

  const handleRemoveHighlightFromToolbar = (hlId) => {
    const targetId = hlId || editingHighlight?.highlight?.id;
    if (targetId && onDeleteHighlight) {
      onDeleteHighlight(conversation?.id || editingHighlight?.highlight?.conversationId, targetId);
    }
    setEditingHighlight(null);
  };

  // Latest completed assistant response for Listen button
  const latestAssistantMessage = [...messages].reverse().find(
    (m) => m.role === 'assistant' && m.content && !m.error
  );

  const handleListenLatest = () => {
    if (ttsState?.status === 'playing') {
      onPauseSpeech?.();
      return;
    }
    if (ttsState?.status === 'paused') {
      onResumeSpeech?.();
      return;
    }
    if (latestAssistantMessage) {
      const msgLang =
        latestAssistantMessage.language ||
        detectLanguageFromText(latestAssistantMessage.content) ||
        selectedLanguage ||
        'en';
      onPlaySpeech?.(
        latestAssistantMessage.id,
        latestAssistantMessage.content,
        msgLang,
        conversation?.id,
        selectedVoice
      );
    }
  };

  const scrollContainerRef = useRef(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // User is considered at bottom if within 100px of scroll edge
    isAtBottomRef.current = distanceFromBottom < 100;
  };

  useEffect(() => {
    if (!isAtBottomRef.current) return;
    if (isGenerating) {
      // Instant scroll during token streaming prevents jitter and frame drops
      scrollEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating]);

  const handleSelectPrompt = (promptText) => {
    onSendMessage(promptText, []);
  };

  const handlePopulatePrompt = (promptText) => {
    setComposerPresetPrompt(promptText);
    composerRef.current?.setPromptText(promptText);
  };

  // Handle specific feature card clicks
  const handleFeatureCardClick = (card) => {
    if (card.id === 'generate-images') {
      if (onOpenImageStudio) {
        onOpenImageStudio();
      } else {
        composerRef.current?.setImageGenActive(true);
        handlePopulatePrompt(card.prompt);
      }
    } else if (card.id === 'analyze-documents') {
      handlePopulatePrompt(card.prompt);
      composerRef.current?.openFilePicker();
    } else {
      handleSelectPrompt(card.prompt);
    }
  };

  return (
    <Box
      sx={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.default',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1
      }}
    >
      {/* 1. Horizontal Workspace Toolbar */}
      <Box
        component="header"
        sx={{
          height: 54,
          px: { xs: 1.5, sm: 2 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: isDark ? 'rgba(9, 13, 22, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          zIndex: 15,
          gap: 1.2
        }}
      >
        {/* Left: Mobile trigger, Sidebar toggle, Model Selector, & active conversation pill */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
          <IconButton
            size="small"
            onClick={onToggleMobileSidebar}
            sx={{ display: { xs: 'flex', md: 'none' }, color: 'text.secondary', p: 0.7 }}
            aria-label="Open navigation menu"
          >
            <MenuIcon size={18} />
          </IconButton>

          {onToggleSidebarCollapse && (
            <Tooltip title="Toggle sidebar">
              <IconButton
                size="small"
                onClick={onToggleSidebarCollapse}
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  color: 'text.secondary',
                  p: 0.65,
                  borderRadius: '8px',
                  '&:hover': { backgroundColor: 'background.hover', color: 'text.primary' }
                }}
                aria-label="Toggle sidebar"
              >
                <PanelLeft size={16} />
              </IconButton>
            </Tooltip>
          )}

          <ModelSelector
            selectedModelId={selectedModelId}
            onSelectModel={onSelectModel}
            disabled={isGenerating}
          />

          {conversation?.title && conversation.title !== 'New Conversation' && (
            <Typography
              variant="body2"
              sx={{
                display: { xs: 'none', xl: 'block' },
                color: 'text.secondary',
                fontWeight: 550,
                fontSize: '0.81rem',
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              • {conversation.title}
            </Typography>
          )}
        </Box>

        {/* Right Controls: Pinecone, Language Selector, Listen, Auto Speak, Highlight, Settings, Overflow */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          {/* Pinecone Connection Status */}
          <PineconeStatusPill />

          {/* Language Selector Bar with Language Code */}
          <LanguageSelectorBar
            selectedLanguage={selectedLanguage}
            onSelectLanguage={onSelectLanguage}
            disabled={isGenerating}
          />

          {/* Listen Button (Reads latest assistant message) */}
          <Tooltip title={ttsState?.status === 'playing' ? 'Pause Speech' : 'Listen to latest reply'}>
            <span>
              <Button
                size="small"
                variant={ttsState?.status === 'playing' ? 'contained' : 'outlined'}
                color="primary"
                startIcon={<Volume2 size={13} />}
                onClick={handleListenLatest}
                disabled={!latestAssistantMessage || isGenerating}
                sx={{
                  height: 30,
                  px: 1,
                  fontSize: '0.75rem',
                  fontWeight: 650,
                  borderRadius: '8px',
                  borderColor: 'divider',
                  backgroundColor: ttsState?.status === 'playing' ? 'primary.main' : 'background.card',
                  color: ttsState?.status === 'playing' ? '#ffffff' : 'text.primary',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: ttsState?.status === 'playing' ? 'primary.dark' : 'background.hover'
                  }
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {ttsState?.status === 'playing' ? 'Playing' : 'Listen'}
                </Box>
              </Button>
            </span>
          </Tooltip>

          {/* Auto Speak Toggle */}
          <Tooltip title={autoPlaySpeech ? 'Auto Speak is ON (Replies are spoken aloud)' : 'Auto Speak is OFF'}>
            <Button
              size="small"
              variant={autoPlaySpeech ? 'contained' : 'outlined'}
              onClick={onToggleAutoPlay}
              startIcon={autoPlaySpeech ? <Volume2 size={13} /> : <VolumeX size={13} />}
              sx={{
                height: 30,
                px: 1,
                fontSize: '0.75rem',
                fontWeight: 650,
                borderRadius: '8px',
                borderColor: autoPlaySpeech ? 'primary.main' : 'divider',
                backgroundColor: autoPlaySpeech ? 'rgba(16, 185, 129, 0.14)' : 'background.card',
                color: autoPlaySpeech ? 'primary.main' : 'text.secondary',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: autoPlaySpeech ? 'rgba(16, 185, 129, 0.2)' : 'background.hover'
                }
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>
                Auto Speak
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: '0.625rem',
                  fontWeight: 750,
                  ml: { xs: 0, lg: 0.5 },
                  color: autoPlaySpeech ? 'primary.main' : 'text.disabled'
                }}
              >
                {autoPlaySpeech ? 'ON' : 'OFF'}
              </Box>
            </Button>
          </Tooltip>

          {/* Highlight Toggle Button */}
          <Tooltip title={isHighlightMode ? 'Highlight Mode is ON' : 'Turn on Text Highlighter'}>
            <IconButton
              size="small"
              onClick={handleToggleHighlightMode}
              sx={{
                height: 30,
                width: 30,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: isHighlightMode ? activeColorObj.swatchColor : 'divider',
                backgroundColor: isHighlightMode ? activeColorObj.swatchColor : 'background.card',
                color: isHighlightMode ? '#ffffff' : 'text.secondary',
                '&:hover': {
                  backgroundColor: isHighlightMode ? activeColorObj.swatchColor : 'background.hover',
                  color: isHighlightMode ? '#ffffff' : 'text.primary'
                }
              }}
            >
              <Highlighter size={14} />
            </IconButton>
          </Tooltip>

          {/* Command Palette Trigger */}
          <Tooltip title="Command Palette (Ctrl + K)">
            <IconButton
              size="small"
              onClick={onOpenCommandPalette}
              sx={{
                height: 30,
                width: 30,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.card',
                color: 'text.secondary',
                '&:hover': { color: 'text.primary', backgroundColor: 'background.hover' }
              }}
            >
              <Command size={14} />
            </IconButton>
          </Tooltip>

          {/* Settings Button */}
          <Tooltip title="Settings">
            <IconButton
              size="small"
              onClick={onOpenSettings}
              sx={{
                height: 30,
                width: 30,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.card',
                color: 'text.secondary',
                display: { xs: 'none', sm: 'inline-flex' },
                '&:hover': { color: 'text.primary', backgroundColor: 'background.hover' }
              }}
            >
              <Settings size={14} />
            </IconButton>
          </Tooltip>

          {/* Overflow Menu (`...`) */}
          <Tooltip title="More options">
            <IconButton
              size="small"
              onClick={(e) => setActionsMenuAnchor(e.currentTarget)}
              sx={{
                height: 30,
                width: 30,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'background.card',
                color: 'text.secondary',
                '&:hover': { color: 'text.primary', backgroundColor: 'background.hover' }
              }}
            >
              <MoreVertical size={14} />
            </IconButton>
          </Tooltip>

          {/* User Profile Avatar */}
          <Tooltip title="Yash Sawant • Profile">
            <Avatar
              onClick={onOpenSettings}
              sx={{
                width: 28,
                height: 28,
                fontSize: '0.74rem',
                fontWeight: 750,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                cursor: 'pointer',
                border: '1.5px solid',
                borderColor: 'divider'
              }}
            >
              Y
            </Avatar>
          </Tooltip>
        </Box>
      </Box>

      {/* Overflow Menu Dropdown */}
      <Menu
        anchorEl={actionsMenuAnchor}
        open={actionsMenuOpen}
        onClose={() => setActionsMenuAnchor(null)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 190,
            border: '1px solid',
            borderColor: 'divider',
            p: 0.4
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {onOpenModelHub && (
          <MenuItem
            onClick={() => {
              setActionsMenuAnchor(null);
              onOpenModelHub();
            }}
            sx={{ gap: 1, fontSize: '0.81rem', py: 0.7 }}
          >
            <Sparkles size={14} color="#10b981" />
            AI Model Hub
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            setActionsMenuAnchor(null);
            setDownloadDialogOpen(true);
          }}
          sx={{ gap: 1, fontSize: '0.81rem', py: 0.7 }}
        >
          <Download size={14} color="#10b981" />
          Export Chat (PDF, HTML, MD)
        </MenuItem>

        {highlights.length > 0 && (
          <MenuItem
            onClick={() => {
              setActionsMenuAnchor(null);
              onClearHighlights && onClearHighlights(conversation?.id);
            }}
            sx={{ gap: 1, fontSize: '0.81rem', py: 0.7, color: '#f59e0b' }}
          >
            <Highlighter size={14} />
            Clear All Highlights ({highlights.length})
          </MenuItem>
        )}

        {messages.length > 0 && <Divider sx={{ my: 0.4 }} />}

        {messages.length > 0 && (
          <MenuItem
            onClick={() => {
              setActionsMenuAnchor(null);
              setClearConfirmOpen(true);
            }}
            sx={{ gap: 1, fontSize: '0.81rem', py: 0.7, color: 'error.main' }}
          >
            <Trash2 size={14} />
            Clear Conversation
          </MenuItem>
        )}
      </Menu>

      {/* 2. Highlighter Control Bar (Active when Highlight Mode is ON) */}
      {isHighlightMode && (
        <HighlighterControlBar
          activeColorKey={highlightColorKey}
          onSelectColorKey={handleSelectColorKey}
          opacity={highlightOpacity}
          onChangeOpacity={(op) => setHighlightOpacity(op)}
          highlightsCount={highlights.length}
          onClearHighlights={() => onClearHighlights && onClearHighlights(conversation?.id)}
          onTurnOff={handleTurnOffHighlightMode}
        />
      )}

      {/* 3. Floating Quick-Action Dock (Requirement 11 - Right Edge Contextual Dock) */}
      <Box
        sx={{
          position: 'absolute',
          top: 68,
          right: 16,
          zIndex: 12,
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          gap: 0.6,
          p: 0.5,
          borderRadius: '12px',
          backgroundColor: isDark ? 'rgba(17, 24, 39, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          border: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)'
        }}
      >
        <Tooltip title="Search & Commands (Ctrl + K)" placement="left">
          <IconButton
            size="small"
            onClick={onOpenCommandPalette}
            sx={{
              color: 'text.secondary',
              p: 0.6,
              borderRadius: '8px',
              '&:hover': { color: 'primary.main', backgroundColor: 'background.hover' }
            }}
          >
            <Search size={15} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Export / Download Chat (PDF, HTML, MD)" placement="left">
          <IconButton
            size="small"
            onClick={() => setDownloadDialogOpen(true)}
            sx={{
              color: 'text.secondary',
              p: 0.6,
              borderRadius: '8px',
              '&:hover': { color: 'primary.main', backgroundColor: 'background.hover' }
            }}
          >
            <Download size={15} />
          </IconButton>
        </Tooltip>

        {onOpenWebSearch && (
          <Tooltip title="Live Web Research Studio" placement="left">
            <IconButton
              size="small"
              onClick={onOpenWebSearch}
              sx={{
                color: 'text.secondary',
                p: 0.6,
                borderRadius: '8px',
                '&:hover': { color: 'primary.main', backgroundColor: 'background.hover' }
              }}
            >
              <Globe size={15} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* 4. Messages & Hero Workspace Scroll Area */}
      <Box
        ref={scrollContainerRef}
        onScroll={handleScroll}
        sx={{
          flex: 1,
          overflowY: 'auto',
          py: 1.5,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {messages.length === 0 ? (
          /* =========================================================================
             PREMIUM WELCOME SCREEN
             ========================================================================= */
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: { xs: 2, sm: 3 },
              maxWidth: 960,
              width: '100%',
              mx: 'auto',
              textAlign: 'center',
              my: 'auto',
              pt: { xs: 1.5, md: 1 },
              pb: 2
            }}
          >
            {/* Centered Yash AI Brand Emblem */}
            <Box
              className="emblem-glowing-pulse"
              sx={{
                width: 54,
                height: 54,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                mb: 1.8,
                transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                '&:hover': {
                  transform: 'scale(1.06)'
                }
              }}
            >
              <Sparkles size={28} />
            </Box>

            {/* Headline: "Hello, I’m Yash AI" */}
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.025em',
                mb: 1,
                fontSize: { xs: '1.65rem', sm: '2.15rem', md: '2.45rem' },
                color: 'text.primary'
              }}
            >
              Hello, I’m{' '}
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block'
                }}
              >
                Yash AI
              </Box>
            </Typography>

            {/* Subtitle */}
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                maxWidth: 620,
                mb: 2.2,
                lineHeight: 1.55,
                fontSize: { xs: '0.885rem', sm: '0.965rem' }
              }}
            >
              Your multi-modal intelligence partner. Ask questions, debug code, generate images, analyze documents, and explore in 10+ languages.
            </Typography>

            {/* Capability Badges Row */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 0.8,
                mb: 3,
                maxWidth: 780
              }}
            >
              {CAPABILITY_BADGES.map((b, idx) => {
                const Icon = b.icon;
                return (
                  <Chip
                    key={idx}
                    icon={<Icon size={13} color="#10b981" />}
                    label={b.label}
                    sx={{
                      height: 26,
                      px: 0.8,
                      fontSize: '0.72rem',
                      fontWeight: 650,
                      borderRadius: '999px',
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(236, 253, 245, 0.9)',
                      border: '1px solid',
                      borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)',
                      color: isDark ? '#34d399' : '#065f46',
                      transition: 'all 0.16s ease',
                      '&:hover': {
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(209, 250, 229, 0.95)',
                        transform: 'translateY(-1px)'
                      }
                    }}
                  />
                );
              })}
            </Box>

            {/* Five Feature Cards in Clean Responsive Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(5, 1fr)'
                },
                gap: 1.5,
                width: '100%',
                mb: 2.8
              }}
            >
              {featureCards.map((card) => {
                const Icon = card.icon || Code2;
                return (
                  <Card
                    key={card.id}
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      borderColor: 'background.cardBorder',
                      backgroundColor: 'background.card',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      '&:hover': {
                        borderColor: 'primary.main',
                        transform: 'translateY(-3px)',
                        boxShadow: isDark
                          ? '0 8px 24px -4px rgba(0,0,0,0.5), 0 0 12px rgba(16, 185, 129, 0.15)'
                          : '0 8px 24px -4px rgba(16, 185, 129, 0.12), 0 2px 8px rgba(0,0,0,0.03)'
                      }
                    }}
                  >
                    <CardActionArea
                      onClick={() => handleFeatureCardClick(card)}
                      sx={{
                        p: 1.8,
                        textAlign: 'left',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Box sx={{ width: '100%' }}>
                        {/* Colored Icon */}
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: '9px',
                            backgroundColor: card.iconBg || 'rgba(16, 185, 129, 0.12)',
                            color: card.iconColor || 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 1.2
                          }}
                        >
                          <Icon size={18} />
                        </Box>

                        {/* Title */}
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700, fontSize: '0.865rem', mb: 0.5, color: 'text.primary' }}
                        >
                          {card.title}
                        </Typography>

                        {/* Concise Description */}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            fontSize: '0.735rem',
                            lineHeight: 1.45,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {card.description}
                        </Typography>
                      </Box>

                      {/* Distinct Action Buttons: Customize & Launch */}
                      <Box sx={{ mt: 1.6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.6, width: '100%' }}>
                        <Tooltip title="Customize starter prompt" arrow>
                          <Box
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePopulatePrompt(card.prompt);
                            }}
                            sx={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              backgroundColor: 'rgba(0,0,0,0.04)',
                              color: 'text.secondary',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              '&:hover': {
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                color: 'primary.main'
                              }
                            }}
                          >
                            <Edit3 size={13} />
                          </Box>
                        </Tooltip>

                        <Box
                          sx={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            color: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                            '.MuiCardActionArea-root:hover &': {
                              backgroundColor: 'primary.main',
                              color: '#ffffff',
                              transform: 'translateX(2px)'
                            }
                          }}
                        >
                          <ArrowRight size={13} />
                        </Box>
                      </Box>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Box>

            {/* Dynamic Clickable Suggestion Chips */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 0.9,
                maxWidth: 880
              }}
            >
              {suggestionChips.map((chip, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: 'background.cardBorder',
                    backgroundColor: 'background.card',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    transition: 'all 0.16s ease',
                    overflow: 'hidden',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'background.hover',
                      transform: 'translateY(-1px)'
                    }
                  }}
                >
                  <Button
                    size="small"
                    onClick={() => handleSelectPrompt(chip.prompt)}
                    sx={{
                      py: 0.6,
                      px: 1.2,
                      fontSize: '0.765rem',
                      fontWeight: 550,
                      textTransform: 'none',
                      color: 'text.secondary',
                      '&:hover': { color: 'text.primary', backgroundColor: 'transparent' }
                    }}
                  >
                    {chip.label}
                  </Button>
                  <Tooltip title="Customize prompt" arrow>
                    <IconButton
                      size="small"
                      onClick={() => handlePopulatePrompt(chip.prompt)}
                      sx={{
                        p: 0.5,
                        mr: 0.3,
                        color: 'text.disabled',
                        '&:hover': { color: 'primary.main', backgroundColor: 'rgba(16, 185, 129, 0.1)' }
                      }}
                    >
                      <Edit3 size={11} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          /* Centered Message List */
          <Box sx={{ flex: 1, width: '100%', maxWidth: '840px', mx: 'auto', px: { xs: 1.5, sm: 2 } }}>
            {messages.map((message, index) => {
              const isLastMessage = index === messages.length - 1;
              const isAssistantStreaming = isLastMessage && isGenerating && message.role === 'assistant';

              return (
                <MessageItem
                  key={message.id || index}
                  message={message}
                  conversationId={conversation?.id}
                  isLatest={isLastMessage}
                  isGenerating={isAssistantStreaming || (isGenerating && isLastMessage && message.role === 'assistant')}
                  isStreaming={isAssistantStreaming}
                  isAnyGenerating={isGenerating}
                  onRegenerate={isLastMessage && message.role === 'assistant' ? onRegenerate : null}
                  onRegenerateWithModel={onRegenerateWithModel}
                  onOpenModelSelector={() => {}}
                  onRefineImage={handleRefineImage}
                  onEditUserMessage={onEditUserMessage}
                  onEditAssistantMessage={onEditAssistantMessage}
                  onSelectSuggestion={(promptText) => onSendMessage(promptText, [])}
                  onSelectFollowUpSuggestion={(promptText) => onSendMessage(promptText, [])}
                  onPopulateSuggestion={(promptText) => handlePopulatePrompt(promptText)}
                  selectedLanguage={selectedLanguage}
                  selectedVoice={selectedVoice}
                  ttsState={ttsState}
                  onPlaySpeech={onPlaySpeech}
                  onPauseSpeech={onPauseSpeech}
                  onResumeSpeech={onResumeSpeech}
                  onStopSpeech={onStopSpeech}
                  onRetrySpeech={retrySpeech => retrySpeech()}
                  onSeekToWord={onSeekToWord}
                  highlights={highlights}
                  onSaveHighlight={onSaveHighlight}
                  onDeleteHighlight={onDeleteHighlight}
                  isHighlightMode={isHighlightMode}
                  highlightMode={isHighlightMode}
                  activeHighlightColor={activeColorObj.getRgba(highlightOpacity)}
                  activeHighlightColorKey={highlightColorKey}
                  onSelectHighlightText={handleSelectHighlightText}
                  onEditHighlight={handleEditHighlight}
                  onClearMessageHighlights={(msgId) => onClearHighlights && onClearHighlights(conversation?.id, msgId)}
                />
              );
            })}
            <div ref={scrollEndRef} />
          </Box>
        )}
      </Box>

      {/* Active contextual follow-up strip above composer */}
      {messages.length > 0 && !isGenerating && (() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.suggestions?.length > 0) {
          return (
            <Box
              sx={{
                width: '100%',
                maxWidth: '840px',
                mx: 'auto',
                px: { xs: 1.5, sm: 2 },
                mb: 0.8,
                display: 'flex',
                alignItems: 'center',
                gap: 0.7,
                overflowX: 'auto',
                py: 0.4,
                '::-webkit-scrollbar': { height: 3 },
                '::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderRadius: 2 }
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.69rem',
                  fontWeight: 700,
                  color: '#10b981',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.4
                }}
              >
                <Sparkles size={12} /> Next:
              </Typography>
              {lastMsg.suggestions.map((sug, idx) => {
                const title = typeof sug === 'object' && sug !== null ? (sug.title || sug.prompt) : sug;
                const prompt = typeof sug === 'object' && sug !== null ? (sug.prompt || sug.title) : sug;
                return (
                  <Chip
                    key={idx}
                    size="small"
                    label={title}
                    onClick={() => handleSelectPrompt(prompt)}
                    onDelete={() => handlePopulatePrompt(prompt)}
                    deleteIcon={
                      <Tooltip title="Customize prompt" arrow>
                        <Box sx={{ display: 'flex', alignItems: 'center', p: 0.2 }}>
                          <Edit3 size={10} />
                        </Box>
                      </Tooltip>
                    }
                    sx={{
                      fontSize: '0.73rem',
                      fontWeight: 550,
                      borderRadius: '8px',
                      borderColor: (theme) =>
                        theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.06)',
                      color: 'text.primary',
                      '&:hover': {
                        backgroundColor: 'rgba(16, 185, 129, 0.18)',
                        borderColor: '#10b981'
                      }
                    }}
                    variant="outlined"
                  />
                );
              })}
            </Box>
          );
        }
        return null;
      })()}

      {/* 5. Fixed Message Composer */}
      <MessageComposer
        ref={composerRef}
        onSendMessage={onSendMessage}
        onStopGeneration={onStopGeneration}
        isGenerating={isGenerating}
        selectedModelId={selectedModelId}
        selectedLanguage={selectedLanguage}
        conversationId={conversation?.id}
        isHighlightMode={isHighlightMode}
        onToggleHighlightMode={handleToggleHighlightMode}
        activeHighlightColorObj={activeColorObj}
        presetPrompt={composerPresetPrompt}
        presetAttachment={composerPresetAttachment}
      />

      {/* 6. Contextual Floating Text Highlight Toolbar */}
      {(activeSelection || editingHighlight) && (
        <TextHighlightToolbar
          position={activeSelection?.rect || editingHighlight?.rect}
          isEditing={Boolean(editingHighlight)}
          highlightId={editingHighlight?.highlight?.id}
          initialColor={editingHighlight?.highlight?.color || activeColorObj.getRgba(highlightOpacity)}
          onApply={handleApplyHighlightFromToolbar}
          onRemove={handleRemoveHighlightFromToolbar}
          onClose={() => {
            setActiveSelection(null);
            setEditingHighlight(null);
          }}
        />
      )}

      {/* Download Chat Dialog */}
      {downloadDialogOpen && (
        <DownloadChatDialog
          open={downloadDialogOpen}
          onClose={() => setDownloadDialogOpen(false)}
          conversation={conversation}
          messages={messages}
          highlights={highlights}
          isGenerating={isGenerating}
        />
      )}

      {/* Clear Chat Confirmation Dialog */}
      <Dialog open={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 650, fontSize: '0.98rem', pb: 1 }}>Clear Current Chat?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to clear the messages in this chat session?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setClearConfirmOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={() => {
              setClearConfirmOpen(false);
              onClearCurrentChat?.();
            }}
            variant="contained"
            color="error"
          >
            Clear
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
