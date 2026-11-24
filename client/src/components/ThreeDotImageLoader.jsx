import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { Sparkles, Brain, Layers, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';

export default function ThreeDotImageLoader({
  modelId = '',
  modelName = '',
  hasReference = false,
  referenceInstruction = '',
  prompt = '',
  compact = false
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => +(prev + 0.5).toFixed(1));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Compute dynamic stage text based on elapsed time
  let stageText = 'Understanding prompt & parsing visual constraints...';
  let StageIcon = Brain;

  const displayModel = modelName || modelId || 'AI Diffusion Model';

  if (elapsed >= 14) {
    stageText = 'Finalizing image output & encoding...';
    StageIcon = ImageIcon;
  } else if (elapsed >= 7) {
    stageText = 'Refining fine details, composition & lighting...';
    StageIcon = Layers;
  } else if (elapsed >= 2.5) {
    stageText = `Synthesizing image with ${displayModel}...`;
    StageIcon = Sparkles;
  }

  if (compact) {
    return (
      <Box
        role="status"
        aria-live="polite"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1.5,
          py: 0.8,
          px: 1.5,
          borderRadius: 2,
          backgroundColor: 'rgba(16, 163, 127, 0.08)',
          border: '1px solid rgba(16, 163, 127, 0.2)'
        }}
      >
        <span className="sr-only">Generating image: {stageText}</span>
        <Box className="three-dot-container" sx={{ p: '4px 8px !important', gap: '6px !important' }}>
          <Box className="three-dot-pip" sx={{ width: '8px !important', height: '8px !important' }} />
          <Box className="three-dot-pip" sx={{ width: '8px !important', height: '8px !important' }} />
          <Box className="three-dot-pip" sx={{ width: '8px !important', height: '8px !important' }} />
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {stageText} ({elapsed}s)
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      className="three-dot-loader-card"
      role="status"
      aria-live="polite"
      aria-label={`Generating image: ${stageText}`}
    >
      {/* Screen Reader Announcement */}
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
        Generating image. Current stage: {stageText}. Elapsed time: {elapsed} seconds.
      </span>

      {/* Ambient Radial Accent Glow */}
      <Box className="three-dot-ambient-glow" />

      {/* Model & Reference Badges */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', zIndex: 1, justifyContent: 'center' }}>
        <Chip
          icon={<Sparkles size={13} color="#10a37f" />}
          label={displayModel}
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.72rem',
            backgroundColor: 'rgba(16, 163, 127, 0.12)',
            color: '#10a37f',
            border: '1px solid rgba(16, 163, 127, 0.3)'
          }}
        />
        {hasReference && (
          <Chip
            icon={<LinkIcon size={12} color="#8b5cf6" />}
            label={referenceInstruction ? `Ref: ${referenceInstruction}` : 'Reference Guided'}
            size="small"
            sx={{
              fontWeight: 600,
              fontSize: '0.7rem',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              color: '#8b5cf6',
              border: '1px solid rgba(139, 92, 246, 0.3)'
            }}
          />
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem', ml: 0.5 }}>
          {elapsed}s
        </Typography>
      </Box>

      {/* Modern Three-Dot Animation */}
      <Box className="three-dot-container">
        <Box className="three-dot-pip" />
        <Box className="three-dot-pip" />
        <Box className="three-dot-pip" />
      </Box>

      {/* Progressive Stage Status Text */}
      <Box className="three-dot-status-text">
        <StageIcon size={15} style={{ color: '#10a37f', flexShrink: 0 }} />
        <Typography
          variant="body2"
          className="three-dot-shimmer"
          sx={{ fontWeight: 600, fontSize: '0.85rem' }}
        >
          {stageText}
        </Typography>
      </Box>

      {/* Prompt preview if available */}
      {prompt && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textAlign: 'center',
            maxWidth: '90%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontStyle: 'italic',
            zIndex: 1,
            opacity: 0.85
          }}
        >
          "{prompt}"
        </Typography>
      )}
    </Box>
  );
}
