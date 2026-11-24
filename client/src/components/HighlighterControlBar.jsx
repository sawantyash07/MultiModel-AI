import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Button
} from '@mui/material';
import {
  Highlighter,
  Check,
  X,
  Trash2,
  Sparkles
} from 'lucide-react';

export const PRIMARY_RGB_COLORS = [
  {
    key: 'red',
    label: 'Red',
    hex: '#FF0000',
    rgb: { r: 255, g: 0, b: 0 },
    swatchColor: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    textColor: '#ef4444',
    getRgba: (alpha = 0.25) => `rgba(255, 0, 0, ${alpha})`
  },
  {
    key: 'green',
    label: 'Green',
    hex: '#00FF00',
    rgb: { r: 0, g: 255, b: 0 },
    swatchColor: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    textColor: '#10b981',
    getRgba: (alpha = 0.25) => `rgba(0, 255, 0, ${alpha})`
  },
  {
    key: 'blue',
    label: 'Blue',
    hex: '#0000FF',
    rgb: { r: 0, g: 0, b: 255 },
    swatchColor: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    textColor: '#3b82f6',
    getRgba: (alpha = 0.25) => `rgba(0, 0, 255, ${alpha})`
  }
];

export const OPACITY_OPTIONS = [
  { value: 0.20, label: '20%' },
  { value: 0.25, label: '25%' },
  { value: 0.30, label: '30%' }
];

export default function HighlighterControlBar({
  activeColorKey = 'green',
  onSelectColorKey,
  opacity = 0.25,
  onChangeOpacity,
  highlightsCount = 0,
  onClearHighlights,
  onTurnOff
}) {
  const currentColor = PRIMARY_RGB_COLORS.find(c => c.key === activeColorKey) || PRIMARY_RGB_COLORS[1];

  return (
    <Box
      className="highlighter-control-bar"
      sx={{
        width: '100%',
        py: 0.8,
        px: { xs: 1.5, sm: 3 },
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(24, 27, 33, 0.96)' : 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        zIndex: 9,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
        animation: 'fadeIn 0.2s ease'
      }}
    >
      {/* Left: Active Mode Indicator */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.7,
            px: 1.2,
            py: 0.4,
            borderRadius: 2,
            backgroundColor: currentColor.badgeBg,
            border: `1px solid ${currentColor.swatchColor}44`,
            color: currentColor.textColor
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: currentColor.swatchColor,
              boxShadow: `0 0 8px ${currentColor.swatchColor}`
            }}
          />
          <Highlighter size={14} />
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.78rem', letterSpacing: 0.3 }}>
            Highlight Mode: ON
          </Typography>
        </Box>

        <Typography
          variant="caption"
          sx={{
            display: { xs: 'none', md: 'inline' },
            color: 'text.secondary',
            fontSize: '0.78rem'
          }}
        >
          Select text in any response or message to highlight in{' '}
          <strong style={{ color: currentColor.textColor }}>{currentColor.label}</strong>
        </Typography>
      </Box>

      {/* Center: Red, Green, Blue Color Swatches */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
            mr: 0.5,
            display: { xs: 'none', sm: 'inline' }
          }}
        >
          Color:
        </Typography>

        {PRIMARY_RGB_COLORS.map((item) => {
          const isSelected = activeColorKey === item.key;
          return (
            <Tooltip key={item.key} title={`Select ${item.label} (${item.hex})`}>
              <Box
                component="button"
                type="button"
                onMouseDown={(e) => {
                  // Prevent deselecting document text selection when clicking swatch
                  e.preventDefault();
                }}
                onClick={() => onSelectColorKey && onSelectColorKey(item.key)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  px: 1.1,
                  py: 0.4,
                  borderRadius: '20px',
                  border: isSelected ? `2px solid ${item.swatchColor}` : '1.5px solid transparent',
                  backgroundColor: isSelected
                    ? item.badgeBg
                    : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                  '&:hover': {
                    backgroundColor: item.badgeBg,
                    borderColor: item.swatchColor
                  }
                }}
              >
                {/* Colored Circle Swatch with Checkmark when Active */}
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: item.swatchColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: isSelected ? `0 0 6px ${item.swatchColor}88` : 'none',
                    border: '1.5px solid rgba(255, 255, 255, 0.7)'
                  }}
                >
                  {isSelected && <Check size={11} strokeWidth={3.5} />}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? item.textColor : 'text.primary',
                    fontSize: '0.78rem'
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}

        {/* Opacity Selector Chips */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.5, ml: 1, pl: 1, borderLeft: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', mr: 0.3 }}>
            Opacity:
          </Typography>
          {OPACITY_OPTIONS.map((op) => (
            <Chip
              key={op.value}
              size="small"
              label={op.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChangeOpacity && onChangeOpacity(op.value)}
              sx={{
                height: 20,
                fontSize: '0.7rem',
                cursor: 'pointer',
                fontWeight: opacity === op.value ? 700 : 500,
                backgroundColor: opacity === op.value ? currentColor.badgeBg : 'transparent',
                color: opacity === op.value ? currentColor.textColor : 'text.secondary',
                border: '1px solid',
                borderColor: opacity === op.value ? currentColor.swatchColor : 'transparent',
                '&:hover': {
                  borderColor: currentColor.swatchColor
                }
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Right: Saved Highlights Count & Turn OFF Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {highlightsCount > 0 && onClearHighlights && (
          <Tooltip title={`Clear all ${highlightsCount} highlights in this conversation`}>
            <Button
              size="small"
              variant="text"
              startIcon={<Trash2 size={13} />}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClearHighlights}
              sx={{
                height: 24,
                fontSize: '0.72rem',
                textTransform: 'none',
                color: 'text.secondary',
                '&:hover': { color: 'error.main', backgroundColor: 'rgba(239, 68, 68, 0.08)' }
              }}
            >
              Clear ({highlightsCount})
            </Button>
          </Tooltip>
        )}

        <Tooltip title="Disable text highlighter (existing highlights remain intact)">
          <Button
            size="small"
            variant="outlined"
            startIcon={<X size={13} />}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onTurnOff}
            sx={{
              height: 24,
              fontSize: '0.72rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 1.5,
              borderColor: 'divider',
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'text.primary',
                color: 'text.primary',
                backgroundColor: 'background.hover'
              }
            }}
          >
            Turn OFF
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );
}
