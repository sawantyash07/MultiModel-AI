import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Button,
  IconButton,
  Chip,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogContent,
  Grid
} from '@mui/material';
import {
  Wand2,
  Download,
  Copy,
  Check,
  Sparkles,
  Zap,
  Maximize2,
  Trash2,
  Clock,
  AlertTriangle,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '../../services/api';
import ThreeDotImageLoader from '../ThreeDotImageLoader';

export default function TextToImagePlayground({
  models = [],
  selectedModelId,
  onSelectModel,
  onShowToast
}) {
  const [currentModelId, setCurrentModelId] = useState(selectedModelId || 'flux-schnell-free');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1 (1024x1024)');
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [history, setHistory] = useState([]);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedModelId) {
      setCurrentModelId(selectedModelId);
    }
  }, [selectedModelId]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await api.getHubImageHistory();
      setHistory(data.images || []);
    } catch (_) {}
  };

  const selectedModel = models.find(m => m.id === currentModelId) || models[0] || {};

  const aspectOptions = [
    { label: '1:1 (Square)', value: '1:1 (512x512)', width: 512, height: 512 },
    { label: '1:1 (HD)', value: '1:1 (1024x1024)', width: 1024, height: 1024 },
    { label: '16:9 (Landscape)', value: '16:9', width: 1024, height: 576 },
    { label: '9:16 (Portrait)', value: '9:16', width: 576, height: 1024 },
    { label: '4:3 (Standard)', value: '4:3', width: 768, height: 576 }
  ];

  const starterPrompts = [
    'A futuristic cyberpunk city with neon reflections in rain puddles, 8k resolution, cinematic lighting',
    'A majestic owl wearing a steampunk monocle perched in an ancient library, intricate detail, digital art',
    'A tranquil Japanese garden with cherry blossoms, wooden bridge, koi pond, golden hour sunlight'
  ];

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setErrorMsg(null);

    const activeAspect = aspectOptions.find(a => a.value === aspectRatio) || aspectOptions[0];

    try {
      const resp = await api.generateHubImage({
        modelId: currentModelId,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        width: activeAspect.width,
        height: activeAspect.height,
        aspectRatio: activeAspect.value,
        enhancePrompt: enhancePrompt
      });

      if (resp.status === 'ERROR') {
        setErrorMsg(resp.error || 'Image generation failed');
        if (onShowToast) onShowToast(resp.error || 'Generation failed', 'error');
      } else {
        setCurrentResult(resp);
        loadHistory();
        if (onShowToast) onShowToast('Image generated successfully!', 'success');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Image generation request failed');
      if (onShowToast) onShowToast(err.message || 'Request failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (imgObj) => {
    const target = imgObj || currentResult;
    if (!target || !target.imageDataUrl) return;

    const link = document.createElement('a');
    link.href = target.imageDataUrl;
    const cleanPrompt = (target.prompt || 'generated_image')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 30);
    link.download = `${cleanPrompt}_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteHistory = async (id) => {
    try {
      await api.deleteHubImage(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      if (currentResult && currentResult.id === id) {
        setCurrentResult(null);
      }
      if (onShowToast) onShowToast('Image removed from history', 'info');
    } catch (err) {
      if (onShowToast) onShowToast('Failed to delete image', 'error');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2.5, overflowY: 'auto', pr: 0.5 }}>
      {/* Configuration Controls Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 280 }}>
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel id="hub-t2i-model-label">Select Image Model</InputLabel>
            <Select
              labelId="hub-t2i-model-label"
              value={currentModelId}
              label="Select Image Model"
              onChange={(e) => {
                setCurrentModelId(e.target.value);
                if (onSelectModel) onSelectModel(e.target.value);
              }}
              sx={{ borderRadius: 2 }}
            >
              {models.map(m => (
                <MenuItem key={m.id} value={m.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {m.name}
                    </Typography>
                    <Chip
                      label={m.status === 'AVAILABLE' ? 'Available' : 'Access Required'}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        backgroundColor: m.status === 'AVAILABLE' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                        color: m.status === 'AVAILABLE' ? '#22c55e' : '#eab308'
                      }}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedModel.provider && (
            <Chip
              label={selectedModel.provider}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
            />
          )}
        </Box>

        {/* Aspect Ratio Selector */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mr: 0.5 }}>
            Aspect Ratio:
          </Typography>
          {aspectOptions.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label}
              size="small"
              onClick={() => setAspectRatio(opt.value)}
              variant={aspectRatio === opt.value ? 'filled' : 'outlined'}
              color={aspectRatio === opt.value ? 'primary' : 'default'}
              sx={{ fontWeight: 600, fontSize: '0.725rem', cursor: 'pointer' }}
            />
          ))}
        </Box>
      </Paper>

      {/* Error Alert */}
      {errorMsg && (
        <Alert
          severity="warning"
          icon={<AlertTriangle size={18} />}
          sx={{ borderRadius: 2.5 }}
          action={
            currentModelId !== 'flux-schnell-free' ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setCurrentModelId('flux-schnell-free');
                  if (onSelectModel) onSelectModel('flux-schnell-free');
                  setErrorMsg(null);
                }}
              >
                Switch to FLUX (Free Tier)
              </Button>
            ) : null
          }
        >
          {errorMsg}
        </Alert>
      )}

      {/* Prompt Composer & Negative Prompt */}
      <Paper
        elevation={0}
        sx={{
          p: 2.2,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.8
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
            Prompt
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Describe the image you want to generate in detail..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
            sx={{ borderRadius: 2 }}
          />
        </Box>

        {/* Starter Prompt Chips */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {starterPrompts.map((sp, idx) => (
            <Chip
              key={idx}
              icon={<Sparkles size={12} />}
              label={sp}
              size="small"
              onClick={() => setPrompt(sp)}
              sx={{
                backgroundColor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                fontSize: '0.725rem',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
            />
          ))}
        </Box>

        {/* Optional Negative Prompt */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.6 }}>
            Negative Prompt (Optional — things to avoid)
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. blurry, low quality, distorted, extra limbs, watermark"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            disabled={isGenerating}
            sx={{ borderRadius: 2 }}
          />
        </Box>

        {/* Actions Row: Prompt Enhancement Toggle & Generate Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, pt: 0.5 }}>
          <Tooltip title="When enabled, enhances lighting and artistic details while preserving all original prompt objects. When disabled, generates strictly using your exact text.">
            <Chip
              icon={<Sparkles size={13} color={enhancePrompt ? '#ec4899' : 'gray'} />}
              label={enhancePrompt ? 'Prompt Enhancement: ON' : 'Prompt Enhancement: OFF'}
              size="small"
              onClick={() => setEnhancePrompt(!enhancePrompt)}
              variant={enhancePrompt ? 'filled' : 'outlined'}
              sx={{
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.75rem',
                backgroundColor: enhancePrompt ? 'rgba(236, 72, 153, 0.12)' : 'transparent',
                color: enhancePrompt ? '#ec4899' : 'text.secondary',
                borderColor: enhancePrompt ? '#ec4899' : 'divider',
                '&:hover': {
                  borderColor: '#ec4899'
                }
              }}
            />
          </Tooltip>

          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            startIcon={isGenerating ? <CircularProgress size={18} color="inherit" /> : <Wand2 size={18} />}
            sx={{
              borderRadius: 2.5,
              px: 4,
              py: 1.1,
              fontWeight: 700,
              fontSize: '0.95rem',
              textTransform: 'none'
            }}
          >
            {isGenerating ? 'Synthesizing Image...' : 'Generate Image'}
          </Button>
        </Box>
      </Paper>

      {/* Modern Animated Three-Dot Loader while generating */}
      {isGenerating && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <ThreeDotImageLoader
            modelId={currentModelId}
            modelName={selectedModel.name || currentModelId}
            prompt={prompt}
          />
        </Box>
      )}

      {/* Main Image Display Card */}
      {!isGenerating && currentResult && currentResult.imageDataUrl && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          {currentResult.fallbackFrom && (
            <Alert severity="info" sx={{ borderRadius: 2, py: 0.5 }}>
              Switched from <strong>{currentResult.fallbackFrom}</strong>: {currentResult.fallbackReason || 'Free Tier Failover'}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Generated Output
              </Typography>
              <Chip
                label={currentResult.modelName || currentResult.modelId}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600, fontSize: '0.725rem' }}
              />
              <Chip
                icon={<Zap size={12} />}
                label={`${currentResult.durationMs}ms`}
                size="small"
                sx={{ backgroundColor: 'action.hover', fontWeight: 600, fontSize: '0.725rem' }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="View full size">
                <IconButton size="small" onClick={() => setZoomOpen(true)}>
                  <Maximize2 size={16} />
                </IconButton>
              </Tooltip>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Download size={14} />}
                onClick={() => handleDownload()}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Save Image
              </Button>
            </Box>
          </Box>

          {/* Rendered Image Container */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'background.default',
              borderRadius: 2.5,
              overflow: 'hidden',
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <img
              src={currentResult.imageDataUrl}
              alt={currentResult.prompt}
              style={{
                maxWidth: '100%',
                maxHeight: 520,
                objectFit: 'contain',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
              }}
            />
          </Box>

          {/* Metadata Footer */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'action.hover',
              p: 1.5,
              borderRadius: 2,
              flexWrap: 'wrap',
              gap: 1
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.825rem', fontStyle: 'italic', flex: 1 }}>
              "{currentResult.prompt}"
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {currentResult.width}x{currentResult.height} ({currentResult.aspectRatio || '1:1'})
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Generated Images History Gallery */}
      {history.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2.2,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Generated Images Gallery ({history.length})
            </Typography>
          </Box>

          <Grid container spacing={1.5}>
            {history.map((item) => (
              <Grid item xs={6} sm={4} md={3} lg={2.4} key={item.id}>
                <Box
                  sx={{
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: currentResult?.id === item.id ? 'primary.main' : 'divider',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'transform 0.15s ease',
                    '&:hover': {
                      transform: 'scale(1.02)',
                      '& .gallery-actions': { opacity: 1 }
                    }
                  }}
                  onClick={() => setCurrentResult(item)}
                >
                  <img
                    src={item.imageDataUrl}
                    alt={item.prompt}
                    style={{
                      width: '100%',
                      height: 120,
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />
                  <Box
                    className="gallery-actions"
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      display: 'flex',
                      gap: 0.5,
                      opacity: 0,
                      transition: 'opacity 0.2s ease',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: 1,
                      p: 0.3
                    }}
                  >
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(item);
                        }}
                        sx={{ color: '#ffffff', p: 0.4 }}
                      >
                        <Download size={13} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHistory(item.id);
                        }}
                        sx={{ color: '#ffffff', p: 0.4 }}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box sx={{ p: 0.8, backgroundColor: 'background.paper' }}>
                    <Typography
                      variant="caption"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        fontSize: '0.7rem',
                        fontWeight: 600
                      }}
                    >
                      {item.prompt}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Full Size Zoom Dialog */}
      <Dialog
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        maxWidth="lg"
        PaperProps={{ sx: { borderRadius: 3, backgroundColor: 'transparent', boxShadow: 'none' } }}
      >
        <DialogContent sx={{ p: 0, display: 'flex', justifyContent: 'center' }}>
          {currentResult && (
            <img
              src={currentResult.imageDataUrl}
              alt={currentResult.prompt}
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: 12
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
