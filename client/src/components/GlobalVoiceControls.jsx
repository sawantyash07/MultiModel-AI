import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Tooltip,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Divider,
  Switch
} from '@mui/material';
import {
  Volume2,
  VolumeX,
  Globe,
  Gauge,
  Check,
  ChevronDown,
  Pause,
  Play,
  Square,
  AlertCircle,
  Search,
  X,
  Mic,
  Info,
  SlidersHorizontal,
  Headphones
} from 'lucide-react';
import {
  SCHEDULED_LANGUAGES,
  TTS_SPEED_OPTIONS,
  findLanguageByCode,
  searchLanguages,
  getVoicesForLanguage,
  isProductionLanguage
} from '../services/useTtsAudio';

export default function GlobalVoiceControls({
  selectedLanguage = 'en',
  onSelectLanguage,
  selectedVoice = 'default',
  onSelectVoice,
  playbackSpeed = 1.0,
  onSelectSpeed,
  autoPlaySpeech = false,
  onToggleAutoPlay,
  ttsState,
  onPlayLatestSpeech,
  onPauseSpeech,
  onResumeSpeech,
  onStopSpeech,
  onRetrySpeech,
  hasAssistantMessage = false,
  disabled = false
}) {
  // Voice Settings Popover state
  const [panelAnchorEl, setPanelAnchorEl] = useState(null);
  const panelOpen = Boolean(panelAnchorEl);

  // Language selector submenu / modal state inside the panel
  const [langMenuAnchorEl, setLangMenuAnchorEl] = useState(null);
  const langMenuOpen = Boolean(langMenuAnchorEl);
  const [languageSearch, setLanguageSearch] = useState('');

  // Voice persona menu state
  const [voiceAnchorEl, setVoiceAnchorEl] = useState(null);
  const voiceOpen = Boolean(voiceAnchorEl);

  // Speed menu state
  const [speedAnchorEl, setSpeedAnchorEl] = useState(null);
  const speedOpen = Boolean(speedAnchorEl);

  const currentLang = useMemo(() => findLanguageByCode(selectedLanguage), [selectedLanguage]);
  const currentSpeed = useMemo(() => {
    return TTS_SPEED_OPTIONS.find((s) => s.value === playbackSpeed) || TTS_SPEED_OPTIONS[1];
  }, [playbackSpeed]);

  const availableVoices = useMemo(() => {
    return getVoicesForLanguage(selectedLanguage);
  }, [selectedLanguage]);

  const activeVoiceObj = useMemo(() => {
    return (
      availableVoices.find((v) => v.id === selectedVoice) ||
      availableVoices[0] || {
        id: selectedVoice || 'default',
        name: selectedVoice || 'Default',
        gender: 'Neutral',
        style: 'Standard'
      }
    );
  }, [availableVoices, selectedVoice]);

  const isCurrentLangProduction = useMemo(() => {
    return isProductionLanguage(selectedLanguage);
  }, [selectedLanguage]);

  const filteredLanguages = useMemo(() => {
    return searchLanguages(languageSearch);
  }, [languageSearch]);

  const isPlaying = ttsState?.status === 'playing';
  const isPaused = ttsState?.status === 'paused';
  const isLoading = ttsState?.status === 'loading';
  const isError = ttsState?.status === 'error' && Boolean(ttsState?.error);

  const handleOpenPanel = (e) => {
    if (!disabled) {
      setPanelAnchorEl(e.currentTarget);
    }
  };

  const handleClosePanel = () => {
    setPanelAnchorEl(null);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0 }}>
      {/* 1. Global Play / Active State Button */}
      {isPlaying ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            height: 30,
            px: 1,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'primary.main',
            backgroundColor: 'rgba(16, 163, 127, 0.12)'
          }}
        >
          {/* Animated sound wave bars */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px', height: 12, mr: 0.4 }}>
            <Box sx={{ width: 2.5, height: 11, bgcolor: 'primary.main', borderRadius: 1, animation: 'soundWaveAnim 0.7s ease-in-out infinite' }} />
            <Box sx={{ width: 2.5, height: 14, bgcolor: 'primary.main', borderRadius: 1, animation: 'soundWaveAnim 0.7s ease-in-out 0.2s infinite' }} />
            <Box sx={{ width: 2.5, height: 8, bgcolor: 'primary.main', borderRadius: 1, animation: 'soundWaveAnim 0.7s ease-in-out 0.4s infinite' }} />
          </Box>

          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: 'primary.main',
              fontSize: '0.72rem',
              display: { xs: 'none', sm: 'inline' }
            }}
          >
            Speaking ({currentSpeed.label})
          </Typography>

          <Tooltip title="Pause speech">
            <IconButton
              size="small"
              onClick={onPauseSpeech}
              sx={{ p: 0.35, color: 'primary.main', '&:hover': { backgroundColor: 'rgba(16, 163, 127, 0.2)' } }}
            >
              <Pause size={13} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Stop speech">
            <IconButton
              size="small"
              onClick={onStopSpeech}
              sx={{ p: 0.35, color: 'text.secondary', '&:hover': { color: 'error.main', backgroundColor: 'background.hover' } }}
            >
              <Square size={11} />
            </IconButton>
          </Tooltip>
        </Box>
      ) : isPaused ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            height: 30,
            px: 1,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.card'
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.secondary',
              fontSize: '0.72rem',
              display: { xs: 'none', sm: 'inline' }
            }}
          >
            Paused ({currentSpeed.label})
          </Typography>

          <Tooltip title="Resume speech">
            <IconButton
              size="small"
              onClick={onResumeSpeech}
              sx={{ p: 0.35, color: 'primary.main', '&:hover': { backgroundColor: 'rgba(16, 163, 127, 0.15)' } }}
            >
              <Play size={13} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Stop speech">
            <IconButton
              size="small"
              onClick={onStopSpeech}
              sx={{ p: 0.35, color: 'text.secondary', '&:hover': { color: 'error.main', backgroundColor: 'background.hover' } }}
            >
              <Square size={11} />
            </IconButton>
          </Tooltip>
        </Box>
      ) : isLoading ? (
        <Button
          size="small"
          disabled
          startIcon={<CircularProgress size={12} sx={{ color: 'primary.main' }} />}
          sx={{
            height: 30,
            px: 1.2,
            fontSize: '0.75rem',
            fontWeight: 500,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            color: 'text.secondary',
            backgroundColor: 'background.card'
          }}
        >
          Preparing...
        </Button>
      ) : isError ? (
        <Tooltip title={`${ttsState?.error || 'Speech failed'}. Click to retry.`}>
          <Button
            size="small"
            onClick={onRetrySpeech}
            startIcon={<AlertCircle size={13} color="#ef4444" />}
            sx={{
              height: 30,
              px: 1.2,
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 2,
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: 'error.main',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.16)' }
            }}
          >
            Retry
          </Button>
        </Tooltip>
      ) : (
        <Tooltip
          title={
            hasAssistantMessage
              ? `Listen to latest response (${currentLang.nativeLabel} at ${currentSpeed.label})`
              : 'No AI response available to speak yet'
          }
        >
          <span>
            <Button
              size="small"
              onClick={onPlayLatestSpeech}
              disabled={!hasAssistantMessage || disabled}
              data-testid="global-voice-play-latest"
              startIcon={<Volume2 size={14} color={hasAssistantMessage ? '#10a37f' : 'currentColor'} />}
              sx={{
                height: 30,
                px: 1.2,
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                color: hasAssistantMessage ? 'text.primary' : 'text.disabled',
                backgroundColor: 'background.card',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'background.hover',
                  color: 'primary.main'
                }
              }}
            >
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>Listen</span>
                <Typography
                  component="span"
                  variant="caption"
                  sx={{
                    fontSize: '0.675rem',
                    color: 'text.secondary',
                    display: { xs: 'none', md: 'inline' }
                  }}
                >
                  ({currentLang.code.toUpperCase()})
                </Typography>
              </Box>
            </Button>
          </span>
        </Tooltip>
      )}

      {/* 2. Unified Spoken Language & Voice Settings Button */}
      <Tooltip title={`Voice Settings: ${currentLang.nativeLabel} (${currentLang.name}) • ${activeVoiceObj.name} • ${currentSpeed.label} • Auto Speak: ${autoPlaySpeech ? 'ON' : 'OFF'}`}>
        <Button
          size="small"
          onClick={handleOpenPanel}
          disabled={disabled}
          startIcon={<Globe size={13} color="#10a37f" />}
          endIcon={<ChevronDown size={12} style={{ opacity: 0.6 }} />}
          sx={{
            height: 30,
            px: 1,
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: 2,
            border: '1px solid',
            borderColor: panelOpen ? 'primary.main' : 'divider',
            color: 'text.primary',
            backgroundColor: 'background.card',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'background.hover'
            }
          }}
        >
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <span>{currentLang.nativeLabel}</span>
            <Chip
              size="small"
              label={currentLang.code.toUpperCase()}
              sx={{
                height: 16,
                fontSize: '0.6rem',
                fontWeight: 700,
                backgroundColor: 'rgba(16, 163, 127, 0.12)',
                color: '#10a37f',
                borderRadius: '4px',
                '& .MuiChip-label': { px: 0.4 }
              }}
            />
          </Box>
        </Button>
      </Tooltip>

      {/* Quick Auto Speak Toggle Button (Direct 1-click access without clutter) */}
      <Tooltip
        title={
          autoPlaySpeech
            ? `Auto Speak is ON: Automatically reads answers in ${currentLang.nativeLabel} (${currentSpeed.label}). Click to turn OFF.`
            : 'Auto Speak is OFF: Click to speak new responses automatically.'
        }
      >
        <Button
          size="small"
          onClick={onToggleAutoPlay}
          data-testid="global-auto-speak-toggle"
          aria-label={`Toggle Auto Speak, currently ${autoPlaySpeech ? 'ON' : 'OFF'}`}
          startIcon={
            autoPlaySpeech ? (
              <Volume2 size={13} color="#10a37f" />
            ) : (
              <VolumeX size={13} style={{ opacity: 0.6 }} />
            )
          }
          sx={{
            height: 30,
            px: 1,
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: 2,
            border: '1px solid',
            borderColor: autoPlaySpeech ? 'primary.main' : 'divider',
            backgroundColor: autoPlaySpeech ? 'rgba(16, 163, 127, 0.12)' : 'background.card',
            color: autoPlaySpeech ? 'primary.main' : 'text.secondary',
            display: { xs: 'none', sm: 'inline-flex' },
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: autoPlaySpeech ? 'rgba(16, 163, 127, 0.2)' : 'background.hover',
              color: autoPlaySpeech ? 'primary.main' : 'text.primary'
            }
          }}
        >
          Auto Speak
        </Button>
      </Tooltip>

      {/* Unified Voice & Audio Settings Popover Panel */}
      <Menu
        anchorEl={panelAnchorEl}
        open={panelOpen}
        onClose={handleClosePanel}
        PaperProps={{
          sx: {
            mt: 0.8,
            width: 320,
            maxHeight: 520,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Panel Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Headphones size={16} color="#10a37f" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              Speech & Audio Settings
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClosePanel} sx={{ p: 0.3, color: 'text.secondary' }}>
            <X size={14} />
          </IconButton>
        </Box>

        {/* Section 1: Auto Speak Setting */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1,
            borderRadius: 2,
            backgroundColor: 'background.card',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.825rem' }}>
              Auto Speak Responses
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }}>
              Speaks answers automatically upon completion
            </Typography>
          </Box>
          <Switch
            size="small"
            checked={autoPlaySpeech}
            onChange={onToggleAutoPlay}
            color="primary"
          />
        </Box>

        {/* Section 2: Spoken Language Selector (All 22 Scheduled Indian Languages + English) */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.6 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Spoken Language (22 Indian + EN)
            </Typography>
            <Chip
              size="small"
              label={`${SCHEDULED_LANGUAGES.length} Languages`}
              sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(16, 163, 127, 0.12)', color: '#10a37f' }}
            />
          </Box>

          <Button
            fullWidth
            size="small"
            onClick={(e) => setLangMenuAnchorEl(e.currentTarget)}
            startIcon={<Globe size={14} color="#10a37f" />}
            endIcon={<ChevronDown size={13} style={{ opacity: 0.6 }} />}
            sx={{
              justifyContent: 'space-between',
              py: 0.7,
              px: 1.2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.card',
              color: 'text.primary',
              fontSize: '0.825rem',
              fontWeight: 600,
              '&:hover': { borderColor: 'primary.main', backgroundColor: 'background.hover' }
            }}
          >
            <span>{currentLang.nativeLabel} ({currentLang.name})</span>
          </Button>
        </Box>

        {/* Section 3: Voice Persona Selector */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.6, display: 'block' }}>
            Voice Persona
          </Typography>

          <Button
            fullWidth
            size="small"
            data-testid="global-voice-persona-button"
            onClick={(e) => setVoiceAnchorEl(e.currentTarget)}
            startIcon={<Mic size={14} color="#10a37f" />}
            endIcon={<ChevronDown size={13} style={{ opacity: 0.6 }} />}
            sx={{
              justifyContent: 'space-between',
              py: 0.7,
              px: 1.2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.card',
              color: 'text.primary',
              fontSize: '0.825rem',
              fontWeight: 600,
              '&:hover': { borderColor: 'primary.main', backgroundColor: 'background.hover' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <span>{activeVoiceObj.name}</span>
              <Chip
                size="small"
                label={activeVoiceObj.gender}
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  backgroundColor: activeVoiceObj.gender === 'Female' ? 'rgba(236, 72, 153, 0.12)' : 'rgba(16, 163, 127, 0.12)',
                  color: activeVoiceObj.gender === 'Female' ? '#ec4899' : '#10a37f'
                }}
              />
            </Box>
          </Button>
        </Box>

        {/* Section 4: Playback Speed Selection */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.6, display: 'block' }}>
            Playback Speed
          </Typography>

          <Box sx={{ display: 'flex', gap: 0.8 }}>
            {TTS_SPEED_OPTIONS.map((opt) => {
              const isSelected = opt.value === playbackSpeed;
              return (
                <Button
                  key={opt.value}
                  size="small"
                  variant={isSelected ? 'contained' : 'outlined'}
                  color={isSelected ? 'primary' : 'inherit'}
                  data-testid="global-voice-speed-button"
                  onClick={() => onSelectSpeed && onSelectSpeed(opt.value)}
                  sx={{
                    flex: 1,
                    py: 0.5,
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    borderRadius: 1.8,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    backgroundColor: isSelected ? 'primary.main' : 'background.card',
                    color: isSelected ? '#ffffff' : 'text.primary',
                    '&:hover': {
                      backgroundColor: isSelected ? 'primary.dark' : 'background.hover',
                      borderColor: 'primary.main'
                    }
                  }}
                >
                  {opt.label}
                </Button>
              );
            })}
          </Box>
        </Box>
      </Menu>

      {/* Submenu 1: Searchable Indian Languages Menu */}
      <Menu
        anchorEl={langMenuAnchorEl}
        open={langMenuOpen}
        onClose={() => {
          setLangMenuAnchorEl(null);
          setLanguageSearch('');
        }}
        PaperProps={{
          sx: {
            mt: 0.5,
            width: 320,
            maxHeight: 440,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      >
        <Box sx={{ p: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            autoFocus
            size="small"
            placeholder="Search language or script..."
            value={languageSearch}
            onChange={(e) => setLanguageSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={14} color="#888" />
                </InputAdornment>
              ),
              endAdornment: languageSearch ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setLanguageSearch('')} sx={{ p: 0.2 }}>
                    <X size={12} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: { height: 32, fontSize: '0.78rem', borderRadius: 1.5, bgcolor: 'background.card' }
            }}
            fullWidth
          />
        </Box>

        <Box sx={{ overflowY: 'auto', flex: 1, py: 0.5 }}>
          {filteredLanguages.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                No languages match "{languageSearch}"
              </Typography>
            </Box>
          ) : (
            filteredLanguages.map((lang) => {
              const isSelected = lang.code === selectedLanguage;
              return (
                <MenuItem
                  key={lang.code}
                  onClick={() => {
                    onSelectLanguage(lang.code);
                    setLangMenuAnchorEl(null);
                    setLanguageSearch('');
                  }}
                  selected={isSelected}
                  sx={{
                    py: 0.8,
                    px: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: 1.5,
                    mx: 0.6,
                    my: 0.2,
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(16, 163, 127, 0.12)',
                      '&:hover': { backgroundColor: 'rgba(16, 163, 127, 0.18)' }
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Typography variant="body2" sx={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.85rem' }}>
                        {lang.nativeLabel}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        ({lang.name})
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.675rem' }}>
                      {lang.script} script • {lang.region}
                    </Typography>
                  </Box>

                  {isSelected && <Check size={16} color="#10a37f" style={{ flexShrink: 0 }} />}
                </MenuItem>
              );
            })
          )}
        </Box>
      </Menu>

      {/* Submenu 2: Voice Persona Menu */}
      <Menu
        anchorEl={voiceAnchorEl}
        open={voiceOpen}
        onClose={() => setVoiceAnchorEl(null)}
        PaperProps={{
          sx: {
            mt: 0.5,
            width: 280,
            maxHeight: 360,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            boxShadow: '0 8px 28px rgba(0,0,0,0.3)'
          }
        }}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      >
        <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Voices for {currentLang.nativeLabel}
          </Typography>
        </Box>

        <Box sx={{ py: 0.5 }}>
          {availableVoices.map((voice) => {
            const isSelected = voice.id === (activeVoiceObj?.id || selectedVoice);
            return (
              <MenuItem
                key={voice.id}
                onClick={() => {
                  if (onSelectVoice) onSelectVoice(voice.id);
                  setVoiceAnchorEl(null);
                }}
                selected={isSelected}
                sx={{
                  py: 0.8,
                  px: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 1.5,
                  mx: 0.6,
                  my: 0.2,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(16, 163, 127, 0.12)',
                    '&:hover': { backgroundColor: 'rgba(16, 163, 127, 0.18)' }
                  }
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <Typography variant="body2" sx={{ fontWeight: isSelected ? 700 : 600, fontSize: '0.825rem' }}>
                      {voice.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={voice.gender}
                      sx={{
                        height: 16,
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        backgroundColor: voice.gender === 'Female' ? 'rgba(236, 72, 153, 0.12)' : 'rgba(16, 163, 127, 0.12)',
                        color: voice.gender === 'Female' ? '#ec4899' : '#10a37f'
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.675rem' }}>
                    {voice.style}
                  </Typography>
                </Box>

                {isSelected && <Check size={16} color="#10a37f" style={{ flexShrink: 0 }} />}
              </MenuItem>
            );
          })}
        </Box>
      </Menu>
    </Box>
  );
}
