import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  Box,
  TextField,
  InputAdornment,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import {
  Search,
  Plus,
  Compass,
  BookOpen,
  Image as ImageIcon,
  Globe,
  Settings,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  UploadCloud,
  Cpu,
  MessageSquare,
  Network,
  Brain,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { TEXT_TO_TEXT_MODELS, IMAGE_TO_TEXT_MODELS } from './ModelSelector';

export default function CommandPalette({
  open,
  onClose,
  onNewChat,
  onSelectView,
  onSelectModel,
  selectedModelId,
  autoPlaySpeech,
  onToggleAutoPlay,
  themeMode,
  onToggleTheme,
  onOpenSettings,
  onOpenMemory,
  onTriggerUpload,
  conversations = [],
  onSelectConversation
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const isDark = themeMode === 'dark';

  // Build command palette catalog
  const commands = useMemo(() => {
    const list = [
      // 1. Core Actions
      {
        id: 'action-new-chat',
        category: 'Action',
        title: 'New Conversation',
        subtitle: 'Start a fresh chat session',
        icon: Plus,
        shortcut: 'Ctrl+N',
        action: () => {
          onSelectView?.('chat');
          onNewChat?.();
        }
      },
      {
        id: 'action-toggle-theme',
        category: 'Action',
        title: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        subtitle: `Currently in ${themeMode} mode`,
        icon: isDark ? Sun : Moon,
        action: () => onToggleTheme?.()
      },
      {
        id: 'action-toggle-voice',
        category: 'Action',
        title: autoPlaySpeech ? 'Disable Auto Speak' : 'Enable Auto Speak',
        subtitle: 'Read assistant replies aloud automatically',
        icon: autoPlaySpeech ? VolumeX : Volume2,
        action: () => onToggleAutoPlay?.()
      },
      {
        id: 'action-upload-file',
        category: 'Action',
        title: 'Upload Document or Image',
        subtitle: 'Attach PDF, DOCX, XLSX, TXT, or images to chat',
        icon: UploadCloud,
        action: () => {
          onSelectView?.('chat');
          onTriggerUpload?.();
        }
      },
      {
        id: 'action-open-settings',
        category: 'Action',
        title: 'Open Settings & Integrations',
        subtitle: 'Manage API keys, Pinecone, and voice configuration',
        icon: Settings,
        action: () => onOpenSettings?.()
      },
      {
        id: 'action-open-memory',
        category: 'Action',
        title: 'AI Memory & Preferences',
        subtitle: 'View persistent learned context and memories',
        icon: Brain,
        action: () => onOpenMemory?.()
      },

      // 2. Navigation Views
      {
        id: 'nav-home',
        category: 'Navigation',
        title: 'Go to Home / Workspace',
        subtitle: 'Main AI chat assistant view',
        icon: Sparkles,
        action: () => onSelectView?.('chat')
      },
      {
        id: 'nav-explore',
        category: 'Navigation',
        title: 'Explore AI Model Hub',
        subtitle: 'Browse all available text, vision, and diffusion models',
        icon: Compass,
        action: () => onSelectView?.('hub')
      },
      {
        id: 'nav-prompts',
        category: 'Navigation',
        title: 'Prompt Library',
        subtitle: 'Curated prompts for coding, concepts, and Indian languages',
        icon: BookOpen,
        action: () => onSelectView?.('prompts')
      },
      {
        id: 'nav-image-gen',
        category: 'Navigation',
        title: 'Image Generation Studio',
        subtitle: 'Generate photorealistic images and visual artwork',
        icon: ImageIcon,
        action: () => onSelectView?.('image-gen')
      },
      {
        id: 'nav-web-search',
        category: 'Navigation',
        title: 'Live Web Search & Research',
        subtitle: 'Query the web with verified anti-hallucination citations',
        icon: Globe,
        action: () => onSelectView?.('web-search')
      },
      {
        id: 'nav-knowledge-graph',
        category: 'Navigation',
        title: 'Knowledge Graph Visualization',
        subtitle: 'Interactive memory and concept graph',
        icon: Network,
        action: () => onSelectView?.('graph')
      }
    ];

    // 3. AI Models Switchers
    [...TEXT_TO_TEXT_MODELS, ...IMAGE_TO_TEXT_MODELS.slice(0, 4)].forEach((m) => {
      list.push({
        id: `model-${m.id}`,
        category: 'AI Models',
        title: `Switch Model: ${m.name}`,
        subtitle: `${m.taskLabel} • ${m.providers?.join(', ') || 'AI Provider'}`,
        icon: Cpu,
        isCurrent: selectedModelId === m.id,
        action: () => {
          onSelectModel?.(m.id);
          onSelectView?.('chat');
        }
      });
    });

    // 4. Recent Conversations
    (conversations || []).slice(0, 8).forEach((c) => {
      list.push({
        id: `conv-${c.id}`,
        category: 'Recent Chats',
        title: c.title || 'Conversation',
        subtitle: c.lastMessagePreview ? c.lastMessagePreview.slice(0, 60) + '...' : 'Open chat',
        icon: MessageSquare,
        action: () => {
          onSelectView?.('chat');
          onSelectConversation?.(c.id);
        }
      });
    });

    return list;
  }, [
    isDark,
    themeMode,
    autoPlaySpeech,
    selectedModelId,
    conversations,
    onNewChat,
    onSelectView,
    onSelectModel,
    onToggleAutoPlay,
    onToggleTheme,
    onOpenSettings,
    onOpenMemory,
    onTriggerUpload,
    onSelectConversation
  ]);

  // Filter commands by query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation inside modal
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3.5,
          overflow: 'hidden',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(16px)',
          border: '1px solid',
          borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
          boxShadow: isDark
            ? '0 25px 60px -10px rgba(0,0,0,0.8), 0 0 30px rgba(16, 185, 129, 0.2)'
            : '0 25px 60px -10px rgba(16, 185, 129, 0.15), 0 10px 30px rgba(0,0,0,0.08)'
        }
      }}
    >
      {/* Top Search Bar */}
      <Box
        sx={{
          p: 1.8,
          pb: 1.2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.2
        }}
      >
        <Search size={20} color="#10b981" />
        <TextField
          inputRef={inputRef}
          fullWidth
          variant="standard"
          placeholder="Type a command, prompt, or search chats..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          InputProps={{
            disableUnderline: true,
            sx: {
              fontSize: '1rem',
              fontWeight: 500
            }
          }}
        />
        <Chip
          size="small"
          label="ESC to exit"
          sx={{
            height: 22,
            fontSize: '0.675rem',
            fontWeight: 600,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            color: 'text.secondary'
          }}
        />
      </Box>

      {/* Commands List */}
      <Box sx={{ maxHeight: 380, overflowY: 'auto', p: 1 }}>
        {filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">No matching commands or chats found</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;

              return (
                <ListItem key={item.id} disablePadding sx={{ mb: 0.3 }}>
                  <ListItemButton
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    selected={isSelected}
                    sx={{
                      borderRadius: 2,
                      py: 0.9,
                      px: 1.4,
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.1)')
                        : 'transparent',
                      border: isSelected ? '1px solid' : '1px solid transparent',
                      borderColor: isSelected ? 'primary.main' : 'transparent',
                      transition: 'all 0.1s ease'
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 32,
                        color: isSelected ? 'primary.main' : 'text.secondary'
                      }}
                    >
                      <Icon size={18} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: isSelected ? 650 : 500,
                              color: isSelected ? 'text.primary' : 'text.primary'
                            }}
                          >
                            {item.title}
                          </Typography>
                          {item.isCurrent && (
                            <Chip
                              size="small"
                              label="Active"
                              color="primary"
                              sx={{ height: 18, fontSize: '0.625rem', fontWeight: 700 }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.72rem',
                            display: 'block',
                            noWrap: true
                          }}
                        >
                          {item.subtitle}
                        </Typography>
                      }
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Chip
                        size="small"
                        label={item.category}
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                          color: 'text.secondary'
                        }}
                      />
                      {item.shortcut && (
                        <Box
                          sx={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: '4px',
                            px: 0.7,
                            py: 0.2,
                            color: 'text.secondary'
                          }}
                        >
                          {item.shortcut}
                        </Box>
                      )}
                      {isSelected && <ArrowRight size={14} color="#10b981" />}
                    </Box>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      {/* Footer Navigation Hints */}
      <Box
        sx={{
          p: 1.2,
          px: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem',
          color: 'text.secondary'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <span>↑↓ Navigate</span>
          <span>↵ Execute</span>
          <span>ESC Close</span>
        </Box>
        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: '0.72rem' }}>
          Yash AI Intelligent Assistant
        </Typography>
      </Box>
    </Dialog>
  );
}
