import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  CircularProgress
} from '@mui/material';
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Send,
  Trash2,
  RefreshCw,
  Palette,
  Upload,
  X,
  Link as LinkIcon,
  Info,
  Maximize2,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import ThreeDotImageLoader from './ThreeDotImageLoader';

const AVAILABLE_STUDIO_MODELS = [
  { id: 'flux-schnell-free', name: 'FLUX.1 [schnell] (Free Diffusion)', provider: 'Pollinations AI (Free)' },
  { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image', provider: 'Google Gemini' },
  { id: 'gemini-3-pro-image', name: 'Gemini 3 Pro Image', provider: 'Google Gemini' },
  { id: 'gemini-nano-banana-2.1', name: 'Gemini Nano Banana 2.1', provider: 'Google Gemini' },
  { id: 'gpt-image-2.5-flare', name: 'GPT Image 2.5 Flare', provider: 'OpenAI' },
  { id: 'gpt-image-2.5-sunburst', name: 'GPT Image 2.5 Sunburst', provider: 'OpenAI' },
  { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base 1.0', provider: 'Hugging Face' }
];

const SAMPLE_IMAGE_PROMPTS = [
  'A high-tech 3D robot arm with carbon-fiber chassis and glowing emerald joints in a robotics cleanroom.',
  'Detailed architectural cutaway of a biomedical MEMS micropump showing fluid channels and piezoelectric diaphragm.',
  'Futuristic Indian smart city with flying solar transit pods, glowing green sky gardens, and majestic architecture at twilight.',
  'Microscopic view of silicon quantum processor chip illuminated with emerald laser beams, macro photography.'
];

export default function ImageStudioView({ onSendToChat, onShowToast }) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [style, setStyle] = useState('Photorealistic');
  const [modelId, setModelId] = useState('flux-schnell-free');
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [allowFallback, setAllowFallback] = useState(false);
  const [referenceImage, setReferenceImage] = useState(null);
  const [referenceInstruction, setReferenceInstruction] = useState('preserve-subject');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isCheckingProvider, setIsCheckingProvider] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleCheckProvider = async () => {
    setIsCheckingProvider(true);
    try {
      const providerId = activeModel?.provider?.toLowerCase().includes('gemini') ? 'gemini' 
        : (activeModel?.provider?.toLowerCase().includes('openai') ? 'openai' : 'gemini');
      const res = await api.checkImageProvider(providerId, modelId);
      setCheckResult(res);
      onShowToast?.(`Provider check: ${res.status} (${res.errorMessage || res.errorReason || 'Checked'})`, res.status === 'AVAILABLE' ? 'success' : 'warning');
    } catch (e) {
      setCheckResult({ status: 'ERROR', errorMessage: e.message });
      onShowToast?.(`Provider check failed: ${e.message}`, 'error');
    } finally {
      setIsCheckingProvider(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await api.getHubImageHistory();
      setHistory(Array.isArray(data) ? data : (data.history || []));
    } catch (_) {}
  };

  const handleReferenceUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onShowToast?.('Please upload a valid image file', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage({
        dataUrl: reader.result,
        name: file.name
      });
      onShowToast?.('Reference image attached!', 'info');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async (targetPrompt, forceFallback = false) => {
    const effectivePrompt = (targetPrompt || prompt).trim();
    if (!effectivePrompt) return;

    const chosenModelId = forceFallback ? 'flux-schnell-free' : modelId;
    if (forceFallback) {
      setModelId('flux-schnell-free');
    }

    setIsGenerating(true);
    setError(null);

    try {
      const res = await api.generateHubImage({
        modelId: chosenModelId,
        prompt: effectivePrompt,
        aspectRatio,
        style: style !== 'None' ? style : null,
        referenceImages: referenceImage ? [referenceImage.dataUrl] : null,
        referenceInstruction: referenceImage ? referenceInstruction : null,
        enhancePrompt,
        allowFallback: forceFallback ? true : allowFallback
      });

      const dataUrl = res?.imageDataUrl || res?.imageUrl || (res?.imageData ? `data:image/jpeg;base64,${res.imageData}` : null);

      if (res && res.status === 'SUCCESS' && dataUrl) {
        const item = {
          id: res.id || `img-${Date.now()}`,
          prompt: effectivePrompt,
          imageUrl: dataUrl,
          modelName: res.actualModelName || res.modelName || chosenModelId,
          modelId: res.actualModelId || res.modelId || chosenModelId,
          actualProvider: res.actualProvider || res.provider,
          fallbackFrom: res.fallbackFrom,
          fallbackReason: res.fallbackReason,
          durationMs: res.durationMs,
          enhancedPrompt: res.enhancedPrompt,
          structuredSpec: res.structuredSpec,
          createdAt: new Date().toISOString()
        };
        setCurrentImage(item);
        setHistory((prev) => [item, ...prev]);

        if (res.fallbackFrom) {
          onShowToast?.(`Image synthesized via failover: ${item.modelName}`, 'info');
        } else {
          onShowToast?.('Image generated successfully!', 'success');
        }
      } else {
        const errMsg = res?.error || 'Image generation failed.';
        setError({
          message: errMsg,
          canFallback: res?.canFallback || chosenModelId !== 'flux-schnell-free',
          fallbackModelId: res?.fallbackModelId || 'flux-schnell-free',
          errorCategory: res?.errorCategory,
          errorReason: res?.errorReason,
          errorNextStep: res?.errorNextStep,
          docUrl: res?.docUrl,
          canRetry: res?.canRetry,
          modelId: chosenModelId,
          provider: activeModel?.provider
        });
        onShowToast?.(errMsg, 'error');
      }
    } catch (err) {
      const errMsg = err.message || 'Image generation service error.';
      setError({
        message: errMsg,
        canFallback: chosenModelId !== 'flux-schnell-free',
        fallbackModelId: 'flux-schnell-free',
        errorCategory: 'EXCEPTION',
        errorReason: 'Unexpected client-side or network exception.',
        errorNextStep: 'Verify backend connectivity and retry.',
        docUrl: 'https://ai.google.dev/gemini-api/docs',
        canRetry: true,
        modelId: chosenModelId,
        provider: activeModel?.provider
      });
      onShowToast?.(errMsg, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url, name) => {
    const a = document.createElement('a');
    a.href = url;
    const clean = (name || 'yash-ai-image').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    a.download = `${clean}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyPrompt = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeModel = AVAILABLE_STUDIO_MODELS.find(m => m.id === modelId) || AVAILABLE_STUDIO_MODELS[0];

  return (
    <Box
      sx={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        backgroundColor: 'background.default',
        p: { xs: 2, sm: 4 },
        maxWidth: 1100,
        mx: 'auto'
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}
          >
            <ImageIcon size={18} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 750, letterSpacing: '-0.02em' }}>
            Image Generation Studio
          </Typography>
          <Chip
            size="small"
            label={`${activeModel.name}`}
            sx={{
              height: 22,
              fontSize: '0.675rem',
              fontWeight: 700,
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Synthesize high-fidelity concept art, diagrams, 3D models, and photorealistic imagery with deep prompt understanding.
        </Typography>
      </Box>

      {/* Generator Card */}
      <Card
        variant="outlined"
        sx={{
          p: 2.5,
          borderRadius: 3.5,
          borderColor: 'background.cardBorder',
          backgroundColor: 'background.card',
          backdropFilter: 'blur(16px)',
          mb: 4,
          boxShadow: '0 8px 30px rgba(16, 185, 129, 0.08)'
        }}
      >
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={5}
          placeholder="Describe the image you want to generate in detail (e.g. 'A sleek carbon-fiber robotic arm with illuminated emerald joints...')"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          sx={{
            mb: 2,
            backgroundColor: 'background.paper',
            borderRadius: 2,
            '& fieldset': { borderColor: 'divider' }
          }}
        />

        {/* Model, Ratio, and Reference Row */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 140px 180px' }, gap: 1.5, mb: 2 }}>
          <FormControl size="small">
            <InputLabel>Synthesis Model</InputLabel>
            <Select
              value={modelId}
              label="Synthesis Model"
              onChange={(e) => setModelId(e.target.value)}
            >
              {AVAILABLE_STUDIO_MODELS.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name} ({m.provider})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small">
            <InputLabel>Aspect Ratio</InputLabel>
            <Select
              value={aspectRatio}
              label="Aspect Ratio"
              onChange={(e) => setAspectRatio(e.target.value)}
            >
              <MenuItem value="1:1">1:1 Square</MenuItem>
              <MenuItem value="16:9">16:9 Landscape</MenuItem>
              <MenuItem value="9:16">9:16 Portrait</MenuItem>
              <MenuItem value="4:3">4:3 Standard</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleReferenceUpload}
            />
            {referenceImage ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, backgroundColor: 'rgba(139, 92, 246, 0.1)', p: 0.6, px: 1, borderRadius: 2 }}>
                <img src={referenceImage.dataUrl} alt="Ref" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                <Typography variant="caption" noWrap sx={{ maxWidth: 80, fontWeight: 600, color: '#8b5cf6' }}>
                  {referenceImage.name}
                </Typography>
                <IconButton size="small" onClick={() => setReferenceImage(null)} sx={{ p: 0.2 }}>
                  <X size={14} />
                </IconButton>
              </Box>
            ) : (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Upload size={14} />}
                onClick={() => fileInputRef.current?.click()}
                sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.78rem' }}
              >
                Attach Reference
              </Button>
            )}
          </Box>
        </Box>

        {/* Reference Instruction Options if Reference Attached */}
        {referenceImage && (
          <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, backgroundColor: 'rgba(139, 92, 246, 0.06)', border: '1px dashed rgba(139, 92, 246, 0.3)' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#8b5cf6', display: 'block', mb: 0.8 }}>
              Reference Guidance Intent:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {[
                { id: 'preserve-subject', label: 'Preserve Subject Appearance' },
                { id: 'change-background', label: 'Change Only Background' },
                { id: 'composition-only', label: 'Match Composition / Layout' },
                { id: 'style-transfer', label: 'Adopt Color & Visual Style' }
              ].map((opt) => (
                <Chip
                  key={opt.id}
                  label={opt.label}
                  size="small"
                  clickable
                  onClick={() => setReferenceInstruction(opt.id)}
                  color={referenceInstruction === opt.id ? 'secondary' : 'default'}
                  variant={referenceInstruction === opt.id ? 'filled' : 'outlined'}
                  sx={{ fontSize: '0.72rem', fontWeight: 600 }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Style & Generate Row */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Style:
            </Typography>
            {['None', 'Photorealistic', '3D Render', 'Cinematic', 'Anime', 'Technical Blueprint'].map((s) => (
              <Chip
                key={s}
                size="small"
                label={s}
                clickable
                onClick={() => setStyle(s)}
                color={style === s ? 'primary' : 'default'}
                variant={style === s ? 'filled' : 'outlined'}
                sx={{ height: 24, fontSize: '0.72rem', fontWeight: 600 }}
              />
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={allowFallback}
                  onChange={(e) => setAllowFallback(e.target.checked)}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Auto-fallback to free models
                </Typography>
              }
              sx={{ m: 0 }}
            />

            <Button
              variant="contained"
              color="primary"
              startIcon={<Sparkles size={16} />}
              disabled={isGenerating || !prompt.trim()}
              onClick={() => handleGenerate(prompt)}
              sx={{ px: 3, py: 1, borderRadius: 2.5, fontWeight: 700 }}
            >
              Generate Image
            </Button>
          </Box>
        </Box>

        {/* Starter Ideas */}
        <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1 }}>
            Starter Ideas:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {SAMPLE_IMAGE_PROMPTS.map((sample, idx) => (
              <Chip
                key={idx}
                size="small"
                label={sample}
                clickable
                onClick={() => {
                  setPrompt(sample);
                  handleGenerate(sample);
                }}
                sx={{
                  maxWidth: 420,
                  fontSize: '0.72rem',
                  backgroundColor: 'background.default',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { borderColor: 'primary.main', backgroundColor: 'background.hover' }
                }}
              />
            ))}
          </Box>
        </Box>
      </Card>

      {/* Explicit Diagnostic Error View */}
      {error && !isGenerating && (
        <Box sx={{
          mb: 4,
          p: 2.5,
          borderRadius: 3.5,
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid',
          borderColor: 'error.main',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Info size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'error.main', mb: 0.5 }}>
                {error.provider || activeModel.name} image generation is unavailable
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary', whiteSpace: 'pre-line', mb: 0.5 }}>
                <strong>Reason:</strong> {error.errorReason || (error.errorCategory === 'ZERO_QUOTA' ? "The selected project's image-generation quota is zero (`limit: 0`)." : error.message)}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.82rem', color: 'text.secondary', whiteSpace: 'pre-line' }}>
                <strong>Next step:</strong> {error.errorNextStep || "Verify the project's billing and quota status in Google AI Studio, or select a configured alternative."}
              </Typography>

              {/* Check Result Badge */}
              {checkResult && (
                <Box sx={{
                  mt: 1,
                  p: 1,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  backgroundColor: checkResult.status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid',
                  borderColor: checkResult.status === 'AVAILABLE' ? '#10b981' : '#f59e0b'
                }}>
                  {checkResult.status === 'AVAILABLE' ? (
                    <CheckCircle2 size={15} color="#10b981" />
                  ) : (
                    <AlertCircle size={15} color="#f59e0b" />
                  )}
                  <Typography variant="caption" sx={{ fontWeight: 600, color: checkResult.status === 'AVAILABLE' ? '#10b981' : '#d97706' }}>
                    Provider Check ({checkResult.status}): {checkResult.errorMessage || checkResult.errorReason || 'Status verified.'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            {/* Check Provider button */}
            <Button
              variant="outlined"
              color="warning"
              size="small"
              startIcon={isCheckingProvider ? <CircularProgress size={13} color="inherit" /> : <RefreshCw size={13} />}
              onClick={handleCheckProvider}
              disabled={isCheckingProvider}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              {isCheckingProvider ? 'Checking Provider...' : 'Check Provider'}
            </Button>

            {/* Open Billing Documentation */}
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<ExternalLink size={13} />}
              component="a"
              href={error.docUrl || 'https://ai.google.dev/gemini-api/docs/billing'}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              Open Billing Documentation
            </Button>

            {/* Try with Free Diffusion */}
            {error.canFallback && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<Sparkles size={14} />}
                onClick={() => handleGenerate(prompt, true)}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
              >
                Try with Free Diffusion (FLUX / Sana)
              </Button>
            )}

            {/* Retry Request */}
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<RefreshCw size={13} />}
              onClick={() => handleGenerate(prompt, false)}
              disabled={!error.canRetry && (!checkResult || checkResult.status !== 'AVAILABLE')}
              title={!error.canRetry && (!checkResult || checkResult.status !== 'AVAILABLE') ? 'Cannot retry while quota is zero. Click Check Provider after linking billing.' : 'Retry request'}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              Retry Request
            </Button>
          </Box>
        </Box>
      )}

      {/* Modern Animated Three-Dot Loader when generating */}
      {isGenerating && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <ThreeDotImageLoader
            modelId={modelId}
            modelName={activeModel.name}
            hasReference={Boolean(referenceImage)}
            referenceInstruction={referenceInstruction}
            prompt={prompt}
          />
        </Box>
      )}

      {/* Generated Result Preview */}
      {!isGenerating && currentImage && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Generated Artwork
          </Typography>
          <Card
            variant="outlined"
            sx={{
              borderRadius: 3.5,
              overflow: 'hidden',
              backgroundColor: 'background.card',
              borderColor: 'primary.main',
              boxShadow: '0 12px 40px rgba(16, 185, 129, 0.15)'
            }}
          >
            <CardMedia
              component="img"
              image={currentImage.imageUrl}
              alt={currentImage.prompt}
              sx={{ maxHeight: 520, objectFit: 'contain', backgroundColor: '#000000' }}
            />
            <CardContent sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
              <Box sx={{ maxWidth: '75%' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 650, fontSize: '0.9rem' }}>
                  {currentImage.prompt}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    label={currentImage.modelName || 'FLUX.1 [schnell]'}
                    sx={{ height: 20, fontSize: '0.675rem', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
                  />
                  {currentImage.durationMs > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {(currentImage.durationMs / 1000).toFixed(1)}s
                    </Typography>
                  )}
                  {currentImage.fallbackFrom && (
                    <Chip
                      size="small"
                      label={`Switched from ${currentImage.fallbackFrom}`}
                      sx={{ height: 20, fontSize: '0.675rem', fontWeight: 600, backgroundColor: 'rgba(234, 179, 8, 0.12)', color: '#ca8a04' }}
                    />
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Download Image">
                  <IconButton
                    size="small"
                    onClick={() => handleDownload(currentImage.imageUrl, currentImage.prompt)}
                    sx={{ backgroundColor: 'background.default', border: '1px solid', borderColor: 'divider' }}
                  >
                    <Download size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Send to Chat">
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={<Send size={14} />}
                    onClick={() => onSendToChat?.(currentImage.imageUrl, currentImage.prompt)}
                    sx={{ borderRadius: 2, fontWeight: 650, fontSize: '0.78rem' }}
                  >
                    Use in Chat
                  </Button>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Gallery / History */}
      {history.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            Generation Gallery ({history.length})
          </Typography>
          <Grid container spacing={2}>
            {history.map((item, idx) => (
              <Grid item xs={12} sm={6} md={4} key={item.id || idx}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    borderColor: 'divider',
                    backgroundColor: 'background.card',
                    transition: 'all 0.2s ease',
                    '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' }
                  }}
                >
                  <CardMedia
                    component="img"
                    height="180"
                    image={item.imageUrl}
                    alt={item.prompt}
                    sx={{ objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => setCurrentImage(item)}
                  />
                  <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" noWrap sx={{ maxWidth: '80%', fontWeight: 550 }}>
                      {item.prompt}
                    </Typography>
                    <IconButton size="small" onClick={() => handleDownload(item.imageUrl, item.prompt)}>
                      <Download size={14} />
                    </IconButton>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
}
