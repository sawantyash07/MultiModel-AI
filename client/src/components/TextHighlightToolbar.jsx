import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Slider,
  TextField,
  Button,
  Paper,
  Fade
} from '@mui/material';
import {
  Highlighter,
  Trash2,
  Check,
  X,
  Palette
} from 'lucide-react';
import { normalizeHighlightColor, getHighlightColorKey } from '../services/textAnnotationEngine';

export const PRIMARY_RGB_PRESETS = [
  { id: 'red',   label: 'Red',   hex: '#EF4444', r: 239, g: 68,  b: 68,  swatchColor: '#ef4444' },
  { id: 'green', label: 'Green', hex: '#10B981', r: 16,  g: 185, b: 129, swatchColor: '#10b981' },
  { id: 'blue',  label: 'Blue',  hex: '#3B82F6', r: 59,  g: 130, b: 246, swatchColor: '#3b82f6' }
];

export const PASTEL_PRESETS = [
  { id: 'yellow', label: 'Soft Yellow', hex: '#FFF2A8', r: 255, g: 242, b: 168 },
  { id: 'green',  label: 'Soft Green',  hex: '#C8F7C5', r: 200, g: 247, b: 197 },
  { id: 'blue',   label: 'Soft Blue',   hex: '#CFE8FF', r: 207, g: 232, b: 255 },
  { id: 'pink',   label: 'Soft Pink',   hex: '#FFD6E7', r: 255, g: 214, b: 231 },
  { id: 'purple', label: 'Soft Purple', hex: '#E6D9FF', r: 230, g: 217, b: 255 }
];

function hexToRgb(hex) {
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length !== 6) {
    return { r: 16, g: 185, b: 129 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r, g, b) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = v => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export default function TextHighlightToolbar({
  position,            // { top, left, bottom, right, width, height }
  initialColor = null, // { r, g, b, a, hex } or string
  isEditing = false,   // true if clicking an existing highlight
  highlightId = null,
  onApply,             // (colorInfo) => void
  onRemove,            // (highlightId) => void
  onClose
}) {
  const [r, setR] = useState(16);
  const [g, setG] = useState(185);
  const [b, setB] = useState(129);
  const [opacity, setOpacity] = useState(0.28);
  const [hex, setHex] = useState('#10B981');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const containerRef = useRef(null);

  // Sync state if initialColor changes
  useEffect(() => {
    if (initialColor) {
      if (typeof initialColor === 'string') {
        const key = getHighlightColorKey(initialColor);
        const preset = PRIMARY_RGB_PRESETS.find(p => p.id === key);
        if (preset) {
          setR(preset.r);
          setG(preset.g);
          setB(preset.b);
          setHex(preset.hex);
          setOpacity(0.28);
          return;
        }

        const match = initialColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
          const nr = Number(match[1]);
          const ng = Number(match[2]);
          const nb = Number(match[3]);
          const na = match[4] !== undefined ? Number(match[4]) : 0.28;
          setR(nr);
          setG(ng);
          setB(nb);
          setOpacity(na);
          setHex(rgbToHex(nr, ng, nb));
          return;
        }
      }
      if (typeof initialColor === 'object') {
        setR(initialColor.r ?? 16);
        setG(initialColor.g ?? 185);
        setB(initialColor.b ?? 129);
        setOpacity(initialColor.a ?? 0.28);
        setHex(initialColor.hex ?? rgbToHex(initialColor.r ?? 16, initialColor.g ?? 185, initialColor.b ?? 129));
      }
    }
  }, [initialColor]);

  // Handle RGB number change
  const handleRgbChange = (channel, val) => {
    const num = Math.max(0, Math.min(255, Number(val) || 0));
    let newR = r, newG = g, newB = b;
    if (channel === 'r') newR = num;
    if (channel === 'g') newG = num;
    if (channel === 'b') newB = num;
    setR(newR);
    setG(newG);
    setB(newB);
    setHex(rgbToHex(newR, newG, newB));
  };

  // Handle HEX change
  const handleHexChange = (e) => {
    const val = e.target.value.toUpperCase();
    setHex(val);
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      const rgb = hexToRgb(val);
      setR(rgb.r);
      setG(rgb.g);
      setB(rgb.b);
    }
  };

  // Preset click: immediately applies highlight or updates current values
  const handlePresetSelect = (preset) => {
    setR(preset.r);
    setG(preset.g);
    setB(preset.b);
    setHex(preset.hex);
    const colorStr = `rgba(${preset.r}, ${preset.g}, ${preset.b}, ${opacity})`;
    onApply && onApply({
      color: colorStr,
      colorKey: preset.id,
      r: preset.r,
      g: preset.g,
      b: preset.b,
      a: opacity,
      hex: preset.hex
    });
  };

  const handleCustomApply = () => {
    const colorStr = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    onApply && onApply({
      color: colorStr,
      colorKey: getHighlightColorKey(colorStr),
      r,
      g,
      b,
      a: opacity,
      hex
    });
  };

  // Close on outside click or escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose && onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  if (!position) return null;

  // Calculate viewport-safe placement
  const toolbarWidth = showAdvanced ? 260 : 210;
  let top = position.top - 48;
  if (top < 10) {
    top = position.bottom + 8; // flip below selection if too close to top
  }
  let left = position.left + (position.width ? position.width / 2 : 0) - toolbarWidth / 2;
  if (left < 10) left = 10;
  if (left + toolbarWidth > window.innerWidth - 10) {
    left = window.innerWidth - toolbarWidth - 10;
  }

  const currentColorRgba = `rgba(${r}, ${g}, ${b}, ${opacity})`;

  return (
    <Fade in={true} timeout={120}>
      <Paper
        ref={containerRef}
        elevation={8}
        onMouseDown={(e) => {
          // Prevent collapsing document text selection
          e.stopPropagation();
        }}
        sx={{
          position: 'fixed',
          top,
          left,
          zIndex: 9999,
          p: 0.8,
          borderRadius: 2.5,
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.8,
          width: toolbarWidth,
          userSelect: 'none'
        }}
      >
        {/* Top Preset Bar: Primary Red, Green, Blue first, then pastels */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            {PRIMARY_RGB_PRESETS.map((p) => {
              const isSelected = hex.toUpperCase() === p.hex.toUpperCase();
              return (
                <Tooltip key={p.id} title={`${p.label} Highlight`} arrow placement="top">
                  <Box
                    component="button"
                    type="button"
                    aria-label={`Highlight ${p.label}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePresetSelect(p)}
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      backgroundColor: p.swatchColor,
                      border: isSelected ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.2)',
                      boxShadow: isSelected ? `0 0 6px ${p.swatchColor}` : 'none',
                      cursor: 'pointer',
                      p: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.15s ease',
                      '&:hover': {
                        transform: 'scale(1.15)'
                      }
                    }}
                  >
                    {isSelected && <Check size={12} color="#ffffff" strokeWidth={3.5} />}
                  </Box>
                </Tooltip>
              );
            })}
            <Box sx={{ width: '1px', height: 16, backgroundColor: 'divider', mx: 0.3 }} />
            {PASTEL_PRESETS.map((p) => {
              const isSelected = hex.toUpperCase() === p.hex.toUpperCase();
              return (
                <Tooltip key={p.id} title={`${p.label}`} arrow placement="top">
                  <Box
                    component="button"
                    type="button"
                    aria-label={`Highlight ${p.label}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePresetSelect(p)}
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: `rgba(${p.r}, ${p.g}, ${p.b}, 0.85)`,
                      border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      p: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                      '&:hover': {
                        transform: 'scale(1.15)',
                        borderColor: '#3b82f6'
                      }
                    }}
                  >
                    {isSelected && <Check size={11} color="#1e293b" strokeWidth={3} />}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
            <Tooltip title={showAdvanced ? "Hide details" : "Custom RGB & Opacity"}>
              <IconButton
                size="small"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowAdvanced(!showAdvanced)}
                sx={{
                  p: 0.4,
                  color: showAdvanced ? 'primary.main' : 'text.secondary',
                  backgroundColor: showAdvanced ? 'action.selected' : 'transparent'
                }}
              >
                <Palette size={15} />
              </IconButton>
            </Tooltip>

            {isEditing && onRemove && (
              <Tooltip title="Remove highlight">
                <IconButton
                  size="small"
                  aria-label="Remove highlight"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onRemove(highlightId)}
                  sx={{ p: 0.4, color: 'error.main' }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Dismiss">
              <IconButton
                size="small"
                aria-label="Close highlight toolbar"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClose}
                sx={{ p: 0.4, color: 'text.disabled' }}
              >
                <X size={15} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Expandable Custom RGB & Opacity Section */}
        {showAdvanced && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.8,
              pt: 0.6,
              borderTop: '1px solid',
              borderColor: 'divider'
            }}
          >
            {/* Live Preview Box */}
            <Box
              sx={{
                p: 0.6,
                borderRadius: 1.5,
                backgroundColor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                fontSize: '0.75rem',
                lineHeight: 1.4,
                color: 'text.primary',
                textAlign: 'center'
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.2, fontSize: '0.68rem' }}>
                Highlight Preview:
              </Typography>
              Sample{' '}
              <span style={{ backgroundColor: currentColorRgba, padding: '1px 4px', borderRadius: 3 }}>
                highlighted text
              </span>{' '}
              preview
            </Box>

            {/* RGB Number Inputs */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              {['r', 'g', 'b'].map((ch) => {
                const val = ch === 'r' ? r : ch === 'g' ? g : b;
                const label = ch.toUpperCase();
                return (
                  <Box key={ch} sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flex: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }}>
                      {label}
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={val}
                      onChange={(e) => handleRgbChange(ch, e.target.value)}
                      inputProps={{ min: 0, max: 255, style: { padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center' } }}
                      sx={{ flex: 1 }}
                    />
                  </Box>
                );
              })}
            </Box>

            {/* Hex Input and Opacity Slider */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                size="small"
                label="HEX"
                value={hex}
                onChange={handleHexChange}
                inputProps={{ maxLength: 7, style: { padding: '3px 6px', fontSize: '0.75rem' } }}
                InputLabelProps={{ shrink: true, style: { fontSize: '0.75rem' } }}
                sx={{ width: 85 }}
              />

              <Box sx={{ flex: 1, px: 0.5 }}>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                  Opacity: {Math.round(opacity * 100)}%
                </Typography>
                <Slider
                  size="small"
                  value={opacity}
                  min={0.15}
                  max={0.8}
                  step={0.05}
                  onChange={(_, val) => setOpacity(val)}
                  sx={{ py: 0.5 }}
                />
              </Box>
            </Box>

            {/* Apply Button */}
            <Button
              size="small"
              variant="contained"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCustomApply}
              startIcon={<Highlighter size={13} />}
              sx={{
                py: 0.4,
                fontSize: '0.75rem',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 1.5,
                backgroundColor: currentColorRgba,
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: currentColorRgba,
                  filter: 'brightness(0.95)'
                }
              }}
            >
              {isEditing ? "Update Highlight" : "Apply Custom Color"}
            </Button>
          </Box>
        )}
      </Paper>
    </Fade>
  );
}
