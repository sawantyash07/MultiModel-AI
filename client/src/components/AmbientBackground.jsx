import React from 'react';
import { Box } from '@mui/material';

export default function AmbientBackground({ themeMode = 'light' }) {
  const isDark = themeMode === 'dark';

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        backgroundColor: 'background.default'
      }}
      aria-hidden="true"
    >
      {/* Light Mode Soft Mint-Green Gradient Wash */}
      {!isDark && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 50% 10%, rgba(209, 250, 229, 0.45) 0%, rgba(236, 253, 245, 0.2) 40%, rgba(248, 250, 252, 0) 80%)'
          }}
        />
      )}

      {/* Dark Mode Deep Obsidian & Emerald Glow Wash */}
      {isDark && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 50% 15%, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.05) 45%, rgba(11, 15, 25, 0) 80%)'
          }}
        />
      )}

      {/* Ambient Flowing Wave 1 (Upper Center) */}
      <Box
        className="ambient-blob-1"
        sx={{
          position: 'absolute',
          top: '-15%',
          left: '25%',
          width: '55vw',
          height: '55vw',
          maxWidth: 700,
          maxHeight: 700,
          borderRadius: '50%',
          filter: 'blur(90px)',
          opacity: isDark ? 0.2 : 0.45,
          background: isDark
            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(6, 95, 70, 0.08) 70%, transparent 100%)'
            : 'radial-gradient(circle, rgba(167, 243, 208, 0.7) 0%, rgba(209, 250, 229, 0.35) 60%, transparent 100%)'
        }}
      />

      {/* Ambient Flowing Wave 2 (Lower Right) */}
      <Box
        className="ambient-blob-2"
        sx={{
          position: 'absolute',
          bottom: '-10%',
          right: '5%',
          width: '45vw',
          height: '45vw',
          maxWidth: 600,
          maxHeight: 600,
          borderRadius: '50%',
          filter: 'blur(100px)',
          opacity: isDark ? 0.15 : 0.35,
          background: isDark
            ? 'radial-gradient(circle, rgba(52, 211, 153, 0.2) 0%, rgba(4, 120, 87, 0.05) 70%, transparent 100%)'
            : 'radial-gradient(circle, rgba(110, 231, 183, 0.5) 0%, rgba(236, 253, 245, 0.2) 65%, transparent 100%)'
        }}
      />

      {/* Ambient Flowing Wave 3 (Lower Left Accent) */}
      <Box
        className="ambient-blob-3"
        sx={{
          position: 'absolute',
          bottom: '15%',
          left: '-8%',
          width: '38vw',
          height: '38vw',
          maxWidth: 500,
          maxHeight: 500,
          borderRadius: '50%',
          filter: 'blur(80px)',
          opacity: isDark ? 0.12 : 0.3,
          background: isDark
            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(209, 250, 229, 0.6) 0%, transparent 70%)'
        }}
      />

      {/* Floating Micro-Particles Layer */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: isDark ? 0.35 : 0.45
        }}
      >
        {[
          { top: '18%', left: '22%', size: 3.5, delay: '0s', dur: '12s' },
          { top: '32%', left: '78%', size: 4, delay: '2s', dur: '15s' },
          { top: '55%', left: '15%', size: 3, delay: '4s', dur: '11s' },
          { top: '68%', left: '85%', size: 4.5, delay: '1s', dur: '14s' },
          { top: '40%', left: '50%', size: 3.5, delay: '3s', dur: '13s' },
          { top: '80%', left: '42%', size: 3, delay: '5s', dur: '16s' }
        ].map((p, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              backgroundColor: isDark ? '#34d399' : '#10b981',
              boxShadow: `0 0 10px ${isDark ? '#34d399' : '#10b981'}`,
              animation: `particleDrift ${p.dur} ease-in-out infinite`,
              animationDelay: p.delay
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
