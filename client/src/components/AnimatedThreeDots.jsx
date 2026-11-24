import React from 'react';
import { Box, Typography, Avatar, useTheme } from '@mui/material';
import { Sparkles, Bot } from 'lucide-react';

/**
 * Premium Animated Three-Dot Indicator for Yash AI
 *
 * Supports two distinct lifecycle variants:
 * 1. "thinking" (State A): Standalone card with assistant identity, subtle "Thinking..." label, and staggered glowing pulse dots.
 * 2. "streaming" (State B): Compact inline three-dot indicator appended seamlessly to the end of streaming markdown text.
 *
 * Features:
 * - Emerald-green accent color with soft glow
 * - Staggered bouncing & pulsing CSS animation
 * - Accessible screen-reader labeling (role="status", aria-live="polite")
 * - Reduced-motion accessibility fallback
 * - Dark & light mode aware
 */
export default function AnimatedThreeDots({
  variant = 'thinking', // 'thinking' | 'streaming' | 'inline'
  size = 'md',          // 'sm' | 'md'
  label = 'Thinking...',
  modelName = null,
  className = ''
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const isStreaming = variant === 'streaming' || variant === 'inline';

  // Compact inline streaming indicator (State B: Receiving response)
  if (isStreaming) {
    return (
      <Box
        component="span"
        role="status"
        aria-live="polite"
        className={`yash-streaming-dots ${className}`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          verticalAlign: 'baseline',
          ml: 0.75,
          position: 'relative',
          top: '-1px'
        }}
      >
        <span className="sr-only">AI is generating response...</span>
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3.5px',
            px: '4px',
            py: '2px',
            borderRadius: '999px',
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
            border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(16, 185, 129, 0.18)'
          }}
        >
          <Box component="span" className="yash-dot-pulse yash-dot-1" sx={{ width: 4.5, height: 4.5 }} />
          <Box component="span" className="yash-dot-pulse yash-dot-2" sx={{ width: 4.5, height: 4.5 }} />
          <Box component="span" className="yash-dot-pulse yash-dot-3" sx={{ width: 4.5, height: 4.5 }} />
        </Box>
      </Box>
    );
  }

  // Standalone thinking card indicator (State A: Waiting for first token)
  const dotSize = size === 'sm' ? 5 : 6.5;

  return (
    <Box
      role="status"
      aria-live="polite"
      className={`yash-thinking-card ${className}`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.5,
        py: 0.8,
        px: 1.6,
        borderRadius: '12px',
        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)',
        border: isDark ? '1px solid rgba(16, 185, 129, 0.22)' : '1px solid rgba(16, 185, 129, 0.16)',
        boxShadow: isDark ? '0 2px 10px rgba(0, 0, 0, 0.25)' : '0 2px 8px rgba(16, 185, 129, 0.06)',
        my: 0.5
      }}
    >
      <span className="sr-only">AI is thinking. Formulating response...</span>

      {/* Assistant Mini Identity Avatar */}
      <Avatar
        sx={{
          width: 22,
          height: 22,
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
          color: isDark ? '#34d399' : '#059669',
          border: '1px solid rgba(16, 185, 129, 0.35)'
        }}
      >
        <Sparkles size={12} />
      </Avatar>

      {/* Thinking Label */}
      <Typography
        variant="body2"
        sx={{
          fontSize: '0.825rem',
          fontWeight: 600,
          color: isDark ? '#a7f3d0' : '#047857',
          letterSpacing: '-0.01em',
          userSelect: 'none'
        }}
      >
        {label}
      </Typography>

      {/* Three Staggered Animated Emerald Dots */}
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          pl: 0.2
        }}
      >
        <Box component="span" className="yash-dot-pulse yash-dot-1" sx={{ width: dotSize, height: dotSize }} />
        <Box component="span" className="yash-dot-pulse yash-dot-2" sx={{ width: dotSize, height: dotSize }} />
        <Box component="span" className="yash-dot-pulse yash-dot-3" sx={{ width: dotSize, height: dotSize }} />
      </Box>
    </Box>
  );
}
