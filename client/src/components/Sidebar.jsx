import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Avatar
} from '@mui/material';
import {
  Sparkles,
  Plus,
  Home,
  Compass,
  BookOpen,
  Image as ImageIcon,
  Globe,
  Settings,
  Search,
  MoreHorizontal,
  Edit2,
  Trash2,
  Download,
  Pin,
  PinOff,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Brain,
  Network,
  Command
} from 'lucide-react';

export default function Sidebar({
  conversations = [],
  currentConversationId = null,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onExportConversation,
  onOpenSettings,
  onOpenMemory,
  memoryCount = 0,
  themeMode = 'light',
  onToggleTheme,
  collapsed = false,
  onToggleCollapse,
  currentView = 'chat',
  onSelectView,
  onOpenCommandPalette
}) {
  const isDark = themeMode === 'dark';
  const [search, setSearch] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [targetConv, setTargetConv] = useState(null);

  // Pinning conversations state persisted in localStorage
  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
      const stored = localStorage.getItem('yash_ai_pinned_chats');
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  });

  // Rename Dialog State
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // Delete Confirmation Dialog State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const togglePin = (convId) => {
    setPinnedIds((prev) => {
      const next = prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId];
      try {
        localStorage.setItem('yash_ai_pinned_chats', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
    handleCloseMenu();
  };

  const handleOpenMenu = (e, conv) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setTargetConv(conv);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
  };

  const handleOpenRename = () => {
    if (targetConv) {
      setNewTitle(targetConv.title || '');
      setRenameDialogOpen(true);
    }
    handleCloseMenu();
  };

  const handleSaveRename = () => {
    if (targetConv && newTitle.trim()) {
      onRenameConversation(targetConv.id, newTitle.trim());
    }
    setRenameDialogOpen(false);
    setTargetConv(null);
  };

  const handleConfirmDelete = () => {
    if (targetConv) {
      onDeleteConversation(targetConv.id);
    }
    setDeleteConfirmOpen(false);
    setTargetConv(null);
  };

  const handleOpenDeleteConfirm = () => {
    setDeleteConfirmOpen(true);
    handleCloseMenu();
  };

  const handleExport = () => {
    if (targetConv && onExportConversation) {
      onExportConversation(targetConv);
    }
    handleCloseMenu();
  };

  // Deduplicate conversations and filter by search
  const uniqueConversations = useMemo(() => {
    return Array.from(
      new Map((conversations || []).filter((c) => c && c.id).map((c) => [c.id, c])).values()
    );
  }, [conversations]);

  const filtered = useMemo(() => {
    if (!search.trim()) return uniqueConversations;
    const q = search.trim().toLowerCase();
    return uniqueConversations.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.lastMessagePreview && c.lastMessagePreview.toLowerCase().includes(q))
    );
  }, [uniqueConversations, search]);

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const pinned = [];
    const today = [];
    const yesterday = [];
    const previous7Days = [];
    const older = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOf7Days = startOfToday - 6 * 86400000;

    filtered.forEach((conv) => {
      if (pinnedIds.includes(conv.id)) {
        pinned.push(conv);
        return;
      }

      let timestamp = null;
      if (conv.updatedAt) timestamp = new Date(conv.updatedAt).getTime();
      else if (conv.createdAt) timestamp = new Date(conv.createdAt).getTime();
      else if (conv.id && conv.id.startsWith('conv-')) {
        const parsed = parseInt(conv.id.replace('conv-', ''), 10);
        if (!isNaN(parsed) && parsed > 1000000000000) {
          timestamp = parsed;
        }
      }

      if (!timestamp || isNaN(timestamp)) {
        today.push(conv);
      } else if (timestamp >= startOfToday) {
        today.push(conv);
      } else if (timestamp >= startOfYesterday) {
        yesterday.push(conv);
      } else if (timestamp >= startOf7Days) {
        previous7Days.push(conv);
      } else {
        older.push(conv);
      }
    });

    const groups = [];
    if (pinned.length > 0) groups.push({ label: 'Pinned', items: pinned, isPinned: true });
    if (today.length > 0) groups.push({ label: 'Today', items: today });
    if (yesterday.length > 0) groups.push({ label: 'Yesterday', items: yesterday });
    if (previous7Days.length > 0) groups.push({ label: 'Previous 7 Days', items: previous7Days });
    if (older.length > 0) groups.push({ label: 'Older', items: older });

    return groups;
  }, [filtered, pinnedIds]);

  // Navigation Links definition
  const primaryNavLinks = [
    { id: 'chat', label: 'Home', icon: Home, badge: null },
    { id: 'hub', label: 'Explore', icon: Compass, badge: 'Models' },
    { id: 'prompts', label: 'Prompt Library', icon: BookOpen, badge: 'New' },
    { id: 'image-gen', label: 'Image Generation', icon: ImageIcon, badge: 'FLUX' },
    { id: 'web-search', label: 'Web Search', icon: Globe, badge: 'Live' },
    { id: 'graph', label: 'Knowledge Graph', icon: Network, badge: null }
  ];

  /* =========================================================================
     COLLAPSED (ICON-RAIL) VIEW (68px)
     ========================================================================= */
  if (collapsed) {
    return (
      <Box
        component="aside"
        aria-label="Sidebar Navigation Rail"
        sx={{
          width: 68,
          height: '100%',
          backgroundColor: 'background.sidebar',
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 1.5,
          userSelect: 'none',
          flexShrink: 0,
          transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Yash AI Logo Emblem + Expand Toggle */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 1.2 }}>
          <Tooltip title="Yash AI Home" placement="right">
            <IconButton
              onClick={() => {
                onSelectView?.('chat');
                onNewChat?.();
              }}
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                boxShadow: isDark
                  ? '0 2px 10px rgba(16, 185, 129, 0.35)'
                  : '0 2px 8px rgba(16, 185, 129, 0.25)',
                p: 0,
                transition: 'all 0.18s ease',
                '&:hover': {
                  transform: 'scale(1.05)'
                }
              }}
            >
              <Sparkles size={20} />
            </IconButton>
          </Tooltip>

          {onToggleCollapse && (
            <Tooltip title="Expand sidebar" placement="right">
              <IconButton
                size="small"
                onClick={onToggleCollapse}
                sx={{
                  color: 'text.secondary',
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  '&:hover': {
                    backgroundColor: 'background.hover',
                    color: 'text.primary'
                  }
                }}
              >
                <PanelLeftOpen size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* New Chat Quick Action */}
        <Tooltip title="New Chat (Ctrl + N)" placement="right">
          <IconButton
            onClick={() => {
              onSelectView?.('chat');
              onNewChat?.();
            }}
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.1)',
              color: 'primary.main',
              border: '1px solid',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
              mb: 1.5,
              transition: 'all 0.18s ease',
              '&:hover': {
                backgroundColor: 'primary.main',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }
            }}
          >
            <Plus size={19} />
          </IconButton>
        </Tooltip>

        <Divider sx={{ width: 32, mb: 1.5 }} />

        {/* Primary View Icons */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, alignItems: 'center', width: '100%' }}>
          {primaryNavLinks.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <Tooltip key={item.id} title={item.label} placement="right">
                <IconButton
                  onClick={() => onSelectView?.(item.id)}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    position: 'relative',
                    color: isActive ? 'primary.main' : 'text.secondary',
                    backgroundColor: isActive
                      ? (isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.08)')
                      : 'transparent',
                    border: isActive ? '1px solid' : '1px solid transparent',
                    borderColor: isActive
                      ? (isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)')
                      : 'transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      color: 'text.primary',
                      backgroundColor: 'background.hover'
                    }
                  }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                  {isActive && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 2,
                        top: '25%',
                        bottom: '25%',
                        width: 3,
                        borderRadius: '0 3px 3px 0',
                        backgroundColor: 'primary.main'
                      }}
                    />
                  )}
                </IconButton>
              </Tooltip>
            );
          })}

          {/* AI Memory Quick Icon */}
          <Tooltip title={`AI Memory (${memoryCount})`} placement="right">
            <IconButton
              onClick={onOpenMemory}
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  backgroundColor: 'background.hover'
                }
              }}
            >
              <Brain size={18} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Bottom Utility Icons */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, alignItems: 'center' }}>
          {onOpenCommandPalette && (
            <Tooltip title="Command Palette (Ctrl + K)" placement="right">
              <IconButton
                onClick={onOpenCommandPalette}
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'text.primary',
                    backgroundColor: 'background.hover'
                  }
                }}
              >
                <Command size={17} />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'} placement="right">
            <IconButton
              onClick={onToggleTheme}
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                color: 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                  backgroundColor: 'background.hover'
                }
              }}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings" placement="right">
            <IconButton
              onClick={onOpenSettings}
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                color: 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                  backgroundColor: 'background.hover'
                }
              }}
            >
              <Settings size={17} />
            </IconButton>
          </Tooltip>

          <Divider sx={{ width: 32, my: 0.5 }} />

          {/* User Profile Avatar with Live Green Status Indicator */}
          <Tooltip title="Yash Sawant • Pro Partner" placement="right">
            <Box
              sx={{ position: 'relative', cursor: 'pointer' }}
              onClick={onOpenSettings}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: '1.5px solid',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#ffffff'
                }}
              >
                Y
              </Avatar>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  border: '1.5px solid',
                  borderColor: 'background.sidebar'
                }}
              />
            </Box>
          </Tooltip>
        </Box>
      </Box>
    );
  }

  /* =========================================================================
     EXPANDED VIEW (260px)
     ========================================================================= */
  return (
    <Box
      component="aside"
      aria-label="Primary Navigation Sidebar"
      sx={{
        width: 260,
        height: '100%',
        backgroundColor: 'background.sidebar',
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0,
        transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* 1. Header with Yash AI Logo and Collapse Button */}
      <Box
        sx={{
          p: 1.5,
          px: 1.8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box
          onClick={() => {
            onSelectView?.('chat');
            onNewChat?.();
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            cursor: 'pointer'
          }}
        >
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              flexShrink: 0
            }}
          >
            <Sparkles size={16} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 750,
                lineHeight: 1.2,
                fontSize: '0.925rem',
                letterSpacing: '-0.02em',
                background: isDark
                  ? 'linear-gradient(135deg, #ffffff 40%, #34d399 100%)'
                  : 'linear-gradient(135deg, #0f172a 40%, #059669 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Yash AI
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.66rem',
                fontWeight: 500,
                display: 'block',
                lineHeight: 1.1
              }}
            >
              Study & Dev Partner
            </Typography>
          </Box>
        </Box>

        {onToggleCollapse && (
          <Tooltip title="Collapse sidebar">
            <IconButton
              size="small"
              onClick={onToggleCollapse}
              sx={{
                color: 'text.secondary',
                p: 0.6,
                borderRadius: '8px',
                '&:hover': {
                  backgroundColor: 'background.hover',
                  color: 'text.primary'
                }
              }}
            >
              <PanelLeftClose size={17} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* 2. New Chat Button */}
      <Box sx={{ p: 1.2, pb: 0.8 }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          startIcon={<Plus size={17} />}
          onClick={() => {
            onSelectView?.('chat');
            onNewChat?.();
          }}
          sx={{
            py: 0.85,
            fontWeight: 650,
            fontSize: '0.84rem',
            borderRadius: '9px',
            justifyContent: 'space-between',
            px: 1.4,
            backgroundColor: '#10b981',
            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.25)',
            '&:hover': {
              backgroundColor: '#059669',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }
          }}
        >
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            New Chat
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: '0.65rem',
              fontWeight: 600,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              px: 0.6,
              py: 0.15,
              borderRadius: '4px',
              letterSpacing: '0.03em'
            }}
          >
            Ctrl+N
          </Box>
        </Button>
      </Box>

      {/* 3. Primary Navigation Items */}
      <Box sx={{ px: 1, pb: 0.5 }}>
        <List sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {primaryNavLinks.map((nav) => {
            const Icon = nav.icon;
            const isSelected = currentView === nav.id;

            return (
              <ListItem key={nav.id} disablePadding>
                <ListItemButton
                  onClick={() => onSelectView?.(nav.id)}
                  selected={isSelected}
                  sx={{
                    borderRadius: '8px',
                    py: 0.6,
                    px: 1.2,
                    backgroundColor: isSelected
                      ? (isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.08)')
                      : 'transparent',
                    border: isSelected ? '1px solid' : '1px solid transparent',
                    borderColor: isSelected
                      ? (isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)')
                      : 'transparent',
                    '&.Mui-selected': {
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.08)',
                      color: 'primary.main',
                      '&:hover': {
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)'
                      }
                    },
                    '&:hover': {
                      backgroundColor: 'background.hover'
                    }
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 26,
                      color: isSelected ? 'primary.main' : 'text.secondary'
                    }}
                  >
                    <Icon size={16} strokeWidth={isSelected ? 2.2 : 1.8} />
                  </ListItemIcon>
                  <ListItemText
                    primary={nav.label}
                    primaryTypographyProps={{
                      fontSize: '0.825rem',
                      fontWeight: isSelected ? 650 : 500,
                      color: isSelected ? 'text.primary' : 'text.secondary'
                    }}
                  />
                  {nav.badge && (
                    <Chip
                      size="small"
                      label={nav.badge}
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        fontWeight: 650,
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.15)')
                          : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'),
                        color: isSelected ? 'primary.main' : 'text.secondary',
                        '& .MuiChip-label': { px: 0.6 }
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ my: 0.8, mx: 1.5 }} />

      {/* 4. Search Filter for Recent Chats */}
      <Box sx={{ px: 1.2, pb: 0.8 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={14} style={{ opacity: 0.6 }} />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')} sx={{ p: 0.2 }}>
                  <X size={12} />
                </IconButton>
              </InputAdornment>
            ) : null,
            sx: {
              borderRadius: '8px',
              fontSize: '0.785rem',
              backgroundColor: 'background.paper',
              height: 32,
              '& fieldset': {
                borderColor: 'divider'
              },
              '&:hover fieldset': {
                borderColor: 'primary.light'
              }
            }
          }}
        />
      </Box>

      {/* 5. Date-Grouped Recent Chats Section */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 0.2 }}>
        {groupedConversations.length === 0 ? (
          <Box sx={{ p: 2.5, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
              {search ? 'No matching chats found' : 'No recent conversations'}
            </Typography>
          </Box>
        ) : (
          groupedConversations.map((group) => (
            <Box key={group.label} sx={{ mb: 1.2 }}>
              <Typography
                variant="caption"
                sx={{
                  px: 1,
                  py: 0.3,
                  color: 'text.secondary',
                  fontWeight: 650,
                  fontSize: '0.67rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5
                }}
              >
                {group.isPinned && <Pin size={11} color="#10b981" />}
                {group.label}
              </Typography>

              <List sx={{ p: 0 }}>
                {group.items.map((conv) => {
                  const isSelected = currentConversationId === conv.id && currentView === 'chat';
                  const isPinned = pinnedIds.includes(conv.id);

                  return (
                    <ListItem
                      key={conv.id}
                      disablePadding
                      secondaryAction={
                        <IconButton
                          size="small"
                          onClick={(e) => handleOpenMenu(e, conv)}
                          sx={{
                            opacity: isSelected ? 1 : 0,
                            '&:hover': { opacity: 1 },
                            color: 'text.secondary',
                            p: 0.35
                          }}
                          className="conv-actions"
                        >
                          <MoreHorizontal size={14} />
                        </IconButton>
                      }
                      sx={{
                        mb: 0.2,
                        '&:hover .conv-actions': { opacity: 1 }
                      }}
                    >
                      <ListItemButton
                        onClick={() => {
                          onSelectView?.('chat');
                          onSelectConversation(conv.id);
                        }}
                        selected={isSelected}
                        sx={{
                          borderRadius: '7px',
                          py: 0.55,
                          px: 0.9,
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.08)')
                            : 'transparent',
                          border: isSelected ? '1px solid' : '1px solid transparent',
                          borderColor: isSelected
                            ? (isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)')
                            : 'transparent',
                          '&.Mui-selected': {
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.08)',
                            '&:hover': {
                              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)'
                            }
                          },
                          '&:hover': {
                            backgroundColor: 'background.hover'
                          }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 20, color: isSelected ? 'primary.main' : 'text.disabled' }}>
                          {isPinned ? (
                            <Pin size={12} color="#10b981" />
                          ) : (
                            <Box
                              sx={{
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                backgroundColor: isSelected ? 'primary.main' : 'divider'
                              }}
                            />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={conv.title || 'New Conversation'}
                          primaryTypographyProps={{
                            variant: 'body2',
                            fontWeight: isSelected ? 650 : 450,
                            noWrap: true,
                            fontSize: '0.81rem',
                            color: isSelected ? 'text.primary' : 'text.secondary'
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          ))
        )}
      </Box>

      {/* 6. Sticky Bottom User Profile Area */}
      <Box
        sx={{
          p: 1.2,
          px: 1.4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box sx={{ position: 'relative' }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.8rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: '1.5px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#ffffff'
              }}
            >
              Y
            </Avatar>
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                border: '1.5px solid #ffffff'
              }}
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              noWrap
              sx={{ fontWeight: 650, fontSize: '0.82rem', lineHeight: 1.2 }}
            >
              Yash Sawant
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{ color: 'text.secondary', fontSize: '0.66rem', display: 'flex', alignItems: 'center', gap: 0.4 }}
            >
              Pro Partner • Active
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
          <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
            <IconButton size="small" onClick={onToggleTheme} sx={{ color: 'text.secondary', p: 0.6 }}>
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </IconButton>
          </Tooltip>

          <Tooltip title={`AI Memory (${memoryCount})`}>
            <IconButton size="small" onClick={onOpenMemory} sx={{ color: 'text.secondary', p: 0.6 }}>
              <Brain size={15} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton size="small" onClick={onOpenSettings} sx={{ color: 'text.secondary', p: 0.6 }}>
              <Settings size={15} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Context Menu for Conversation Item */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 170,
            border: '1px solid',
            borderColor: 'divider',
            p: 0.4
          }
        }}
      >
        {targetConv && (
          <MenuItem onClick={() => togglePin(targetConv.id)} sx={{ gap: 1, fontSize: '0.8rem', py: 0.7 }}>
            {pinnedIds.includes(targetConv.id) ? (
              <>
                <PinOff size={14} />
                Unpin from top
              </>
            ) : (
              <>
                <Pin size={14} />
                Pin to top
              </>
            )}
          </MenuItem>
        )}

        <MenuItem onClick={handleOpenRename} sx={{ gap: 1, fontSize: '0.8rem', py: 0.7 }}>
          <Edit2 size={14} />
          Rename
        </MenuItem>

        <MenuItem onClick={handleExport} sx={{ gap: 1, fontSize: '0.8rem', py: 0.7 }}>
          <Download size={14} />
          Export / Download
        </MenuItem>

        <Divider sx={{ my: 0.4 }} />

        <MenuItem onClick={handleOpenDeleteConfirm} sx={{ gap: 1, fontSize: '0.8rem', py: 0.7, color: 'error.main' }}>
          <Trash2 size={14} />
          Delete
        </MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 650, fontSize: '0.98rem', pb: 1 }}>Rename Conversation</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Conversation Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename();
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSaveRename} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 650, fontSize: '0.98rem', pb: 1 }}>Delete Conversation?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete &ldquo;{targetConv?.title || 'this conversation'}&rdquo;? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
