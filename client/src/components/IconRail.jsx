import React from 'react';
import { Box, IconButton, Tooltip, Divider, Avatar } from '@mui/material';
import {
  Sparkles,
  Plus,
  Home,
  Compass,
  BookOpen,
  Image as ImageIcon,
  Globe,
  Network,
  Brain,
  Search,
  Sun,
  Moon,
  Settings,
  Command
} from 'lucide-react';

export default function IconRail({
  currentView = 'chat',
  onSelectView,
  onNewChat,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenMemory,
  themeMode = 'light',
  onToggleTheme,
  memoryCount = 0
}) {
  const isDark = themeMode === 'dark';

  const navItems = [
    { id: 'chat', label: 'Home (Chat)', icon: Home },
    { id: 'hub', label: 'Explore (Model Hub)', icon: Compass },
    { id: 'prompts', label: 'Prompt Library', icon: BookOpen },
    { id: 'image-gen', label: 'Image Studio', icon: ImageIcon },
    { id: 'web-search', label: 'Web Search', icon: Globe },
    { id: 'graph', label: 'Knowledge Graph', icon: Network },
    { id: 'memory', label: `AI Memory (${memoryCount})`, icon: Brain, action: onOpenMemory }
  ];

  return (
    <Box
      component="nav"
      aria-label="Quick Action Rail"
      sx={{
        width: 58,
        height: '100%',
        backgroundColor: 'background.rail',
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1.5,
        gap: 1.2,
        zIndex: 25,
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* 1. Glowing Yash AI Spark Emblem */}
      <Tooltip title="Yash AI Home" placement="right">
        <IconButton
          onClick={() => {
            onSelectView?.('chat');
            onNewChat?.();
          }}
          sx={{
            width: 38,
            height: 38,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            boxShadow: isDark
              ? '0 0 16px rgba(16, 185, 129, 0.45)'
              : '0 4px 14px rgba(16, 185, 129, 0.35)',
            p: 0,
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            '&:hover': {
              transform: 'scale(1.05)',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)'
            }
          }}
        >
          <Sparkles size={19} />
        </IconButton>
      </Tooltip>

      {/* 2. New Chat Quick Action */}
      <Tooltip title="New Chat (Ctrl + N)" placement="right">
        <IconButton
          onClick={() => {
            onSelectView?.('chat');
            onNewChat?.();
          }}
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.12)',
            color: 'primary.main',
            border: '1px solid',
            borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
            transition: 'all 0.18s ease',
            '&:hover': {
              backgroundColor: 'primary.main',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }
          }}
        >
          <Plus size={18} />
        </IconButton>
      </Tooltip>

      <Divider sx={{ width: 28, my: 0.2 }} />

      {/* 3. Primary Nav Icons */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, alignItems: 'center' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <Tooltip key={item.id} title={item.label} placement="right">
              <IconButton
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else {
                    onSelectView?.(item.id);
                  }
                }}
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  position: 'relative',
                  color: isActive ? 'primary.main' : 'text.secondary',
                  backgroundColor: isActive
                    ? (isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.1)')
                    : 'transparent',
                  border: isActive ? '1px solid' : '1px solid transparent',
                  borderColor: isActive
                    ? (isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.25)')
                    : 'transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    color: 'text.primary',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                <Icon size={18} strokeWidth={isActive ? 2.3 : 1.8} />
                {isActive && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -2,
                      top: '25%',
                      bottom: '25%',
                      width: 3.5,
                      borderRadius: '0 4px 4px 0',
                      backgroundColor: 'primary.main',
                      boxShadow: '0 0 8px #10b981'
                    }}
                  />
                )}
              </IconButton>
            </Tooltip>
          );
        })}
      </Box>

      {/* Spacer to push controls to bottom */}
      <Box sx={{ flex: 1 }} />

      {/* 4. Bottom Utilities: Command Palette, Theme, Settings, Profile */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, alignItems: 'center' }}>
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
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            <Command size={17} />
          </IconButton>
        </Tooltip>

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
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'
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
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            <Settings size={17} />
          </IconButton>
        </Tooltip>

        <Divider sx={{ width: 28, my: 0.2 }} />

        {/* User Avatar with Green Active Dot */}
        <Tooltip title="Yash Sawant • Pro" placement="right">
          <Box sx={{ position: 'relative', cursor: 'pointer' }} onClick={onOpenSettings}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.8rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                color: '#ffffff',
                border: '1.5px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#ffffff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
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
                borderColor: 'background.rail',
                boxShadow: '0 0 5px #10b981'
              }}
            />
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
}
