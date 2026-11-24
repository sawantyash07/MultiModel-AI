import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Menu,
  MenuItem,
  Chip,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  ChevronDown,
  Sparkles,
  Code,
  Brain,
  Check,
  Server,
  HardDrive,
  Eye,
  MessageSquare,
  Search,
  Zap,
  Image as ImageIcon,
  ShieldCheck,
  Radio,
  Layers,
  Wand2
} from 'lucide-react';
import { api } from '../services/api';

// Verified Fallback Models across 12 Official Categories
export const DEFAULT_MODELS = [
  {
    id: 'auto',
    name: 'Auto (Smart Multi-Modal Routing)',
    provider: 'Yash AI Router',
    providerId: 'auto',
    categories: ['text-generation-and-reasoning', 'any-to-any-multimodal'],
    verifiedQuota: 'Auto-Optimized Free Tier',
    latencyMs: 120,
    supportedInputModalities: ['text', 'image', 'audio', 'document'],
    supportedOutputModalities: ['text', 'image', 'audio'],
    description: 'Intelligently analyzes your prompt and attachments, routing to the optimal free model automatically.',
    isRecommended: true
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google Gemini',
    providerId: 'gemini',
    categories: ['text-generation-and-reasoning', 'any-to-any-multimodal', 'video-to-text-and-video-understanding'],
    verifiedQuota: '15 RPM | 1,500 RPD',
    latencyMs: 150,
    supportedInputModalities: ['text', 'image', 'audio', 'video'],
    supportedOutputModalities: ['text'],
    description: 'High-speed frontier intelligence with 1M context, generous free-tier hosted inference, and multi-turn audio/vision.',
    isRecommended: true
  },
  {
    id: 'gemini-2.5-flash-vision',
    name: 'Gemini 2.5 Flash Vision',
    provider: 'Google Gemini',
    providerId: 'gemini',
    categories: ['image-and-text-to-text', 'image-to-text'],
    verifiedQuota: '15 RPM | 1,500 RPD',
    latencyMs: 160,
    supportedInputModalities: ['text', 'image'],
    supportedOutputModalities: ['text'],
    description: 'Frontier multimodal vision model for image comprehension, OCR, diagram breakdown, and visual Q&A.',
    isRecommended: true
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile (Groq)',
    provider: 'Groq LPU Cloud',
    providerId: 'groq',
    categories: ['text-generation-and-reasoning'],
    verifiedQuota: '30 RPM | 1,000 RPD (350+ tok/s)',
    latencyMs: 95,
    supportedInputModalities: ['text'],
    supportedOutputModalities: ['text'],
    description: 'Ultra-fast 70B model running at 350+ tokens/sec on Groq LPUs. Free tier 1,000 requests/day.',
    isRecommended: true
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant (Groq)',
    provider: 'Groq LPU Cloud',
    providerId: 'groq',
    categories: ['text-generation-and-reasoning'],
    verifiedQuota: '30 RPM | 14,400 RPD (800+ tok/s)',
    latencyMs: 45,
    supportedInputModalities: ['text'],
    supportedOutputModalities: ['text'],
    description: 'Near-instantaneous token generation (800+ tok/s) with 14,400 free requests per day on Groq LPUs.',
    isRecommended: false
  },
  {
    id: 'qwen2.5:7b',
    name: 'Qwen 2.5 7B (Local Ollama)',
    provider: 'Local Ollama',
    providerId: 'ollama',
    categories: ['text-generation-and-reasoning'],
    verifiedQuota: 'Unlimited / 100% Free Local',
    latencyMs: 60,
    supportedInputModalities: ['text'],
    supportedOutputModalities: ['text'],
    description: 'Alibaba coding & instruction model running locally with 100% privacy and zero network costs.',
    isRecommended: false
  },
  {
    id: 'flux-schnell-free',
    name: 'FLUX.1 [schnell] (Free Diffusion)',
    provider: 'Pollinations AI',
    providerId: 'pollinations',
    categories: ['text-to-image'],
    verifiedQuota: 'Unlimited Free Hosted',
    latencyMs: 950,
    supportedInputModalities: ['text'],
    supportedOutputModalities: ['image'],
    description: '1-4 step rectified flow diffusion model generating high-resolution digital art with zero token requirement.',
    isRecommended: true
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Gemini 3.1 Flash Image',
    provider: 'Google Gemini',
    providerId: 'gemini',
    categories: ['text-to-image', 'image-to-image'],
    verifiedQuota: 'ai.google.dev (Auto Failover)',
    latencyMs: 1400,
    supportedInputModalities: ['text', 'image'],
    supportedOutputModalities: ['image'],
    description: "Google's frontier efficient image generation and editing model with advanced prompt comprehension and reference adherence.",
    isRecommended: true
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Gemini 3 Pro Image',
    provider: 'Google Gemini',
    providerId: 'gemini',
    categories: ['text-to-image', 'image-to-image'],
    verifiedQuota: 'ai.google.dev (Auto Failover)',
    latencyMs: 2200,
    supportedInputModalities: ['text', 'image'],
    supportedOutputModalities: ['image'],
    description: "Demanding professional visual synthesis for high-fidelity composition, technical diagrams, and complex typography.",
    isRecommended: false
  },
  {
    id: 'gemini-nano-banana-2.1',
    name: 'Gemini Nano Banana 2.1',
    provider: 'Google Gemini',
    providerId: 'gemini',
    categories: ['text-to-image', 'image-to-image'],
    verifiedQuota: 'ai.google.dev (Auto Failover)',
    latencyMs: 850,
    supportedInputModalities: ['text', 'image'],
    supportedOutputModalities: ['image'],
    description: 'Ultra-fast lightweight visual synthesis optimized for rapid generation and responsive styling.',
    isRecommended: false
  },
  {
    id: 'gpt-image-2.5-flare',
    name: 'GPT Image 2.5 Flare',
    provider: 'OpenAI',
    providerId: 'openai',
    categories: ['text-to-image'],
    verifiedQuota: 'api.openai.com (Auto Failover)',
    latencyMs: 1600,
    supportedInputModalities: ['text'],
    supportedOutputModalities: ['image'],
    description: "Fast, high-quality everyday generation with superior text rendering and visual fidelity by OpenAI.",
    isRecommended: true
  },
  {
    id: 'gpt-image-2.5-sunburst',
    name: 'GPT Image 2.5 Sunburst',
    provider: 'OpenAI',
    providerId: 'openai',
    categories: ['text-to-image', 'image-to-image'],
    verifiedQuota: 'api.openai.com (Auto Failover)',
    latencyMs: 2500,
    supportedInputModalities: ['text', 'image'],
    supportedOutputModalities: ['image'],
    description: 'Specialized for precise visual editing, reference-image fidelity, and rigorous visual constraint adherence.',
    isRecommended: false
  },
  {
    id: 'black-forest-labs/FLUX.1-schnell',
    name: 'FLUX.1 [schnell] (HuggingFace)',
    provider: 'Hugging Face',
    providerId: 'huggingface',
    categories: ['text-to-image'],
    verifiedQuota: 'Router PRO / Credits',
    latencyMs: 1200,
    supportedInputModalities: ['text'],
    supportedOutputModalities: ['image'],
    description: 'Official 12B parameter FLUX model hosted on Hugging Face router.',
    isRecommended: false
  },
  {
    id: 'stabilityai/stable-diffusion-xl-base-1.0',
    name: 'Stable Diffusion XL Base 1.0',
    provider: 'Hugging Face',
    providerId: 'huggingface',
    categories: ['text-to-image'],
    verifiedQuota: 'Router PRO / Credits',
    latencyMs: 1800,
    supportedInputModalities: ['text'],
    supportedOutputModalities: ['image'],
    description: 'Stability AI flagship SDXL diffusion model for photorealistic art.',
    isRecommended: false
  },
  {
    id: 'Salesforce/blip-image-captioning-large',
    name: 'BLIP Image Captioning Large',
    provider: 'Hugging Face',
    providerId: 'huggingface',
    categories: ['image-to-text'],
    verifiedQuota: 'Serverless Free Pool',
    latencyMs: 280,
    supportedInputModalities: ['image'],
    supportedOutputModalities: ['text'],
    description: 'Visual captioning transformer by Salesforce generating detailed scene and subject descriptions.',
    isRecommended: false
  },
  {
    id: 'google-hosted-tts',
    name: 'Google Hosted Multilingual TTS',
    provider: 'Google / WebSpeech',
    providerId: 'google-tts',
    categories: ['text-to-speech'],
    verifiedQuota: 'Unlimited Free Web Tier',
    latencyMs: 80,
    supportedInputModalities: ['text'],
    supportedOutputModalities: ['audio'],
    description: 'Neural voice synthesis supporting natural speech in English, Hindi, and 20+ world languages with real-time word highlighting.',
    isRecommended: true
  },
  {
    id: 'openai/whisper-large-v3',
    name: 'Whisper Large v3 (Groq Speech)',
    provider: 'Groq LPU Cloud',
    providerId: 'groq',
    categories: ['speech-to-text-and-audio-understanding'],
    verifiedQuota: '20 Audio Req/Min | 2k RPD',
    latencyMs: 140,
    supportedInputModalities: ['audio'],
    supportedOutputModalities: ['text'],
    description: 'State-of-the-art speech transcription and audio translation running at high speed on Groq LPUs.',
    isRecommended: true
  },
  {
    id: 'sentence-transformers/all-MiniLM-L6-v2',
    name: 'all-MiniLM-L6-v2 (Local Embeddings)',
    provider: 'Local ONNX',
    providerId: 'local-onnx',
    categories: ['embeddings-and-reranking'],
    verifiedQuota: 'Unlimited In-Memory Java',
    latencyMs: 5,
    supportedInputModalities: ['text'],
    supportedOutputModalities: ['embedding'],
    description: 'In-process 384-dimensional dense semantic embedding engine for instant Pinecone indexing and RAG retrieval.',
    isRecommended: true
  }
];

export const TEXT_TO_TEXT_MODELS = DEFAULT_MODELS.filter(m => m.categories?.includes('text-generation-and-reasoning') || m.id === 'auto');
export const IMAGE_TO_TEXT_MODELS = DEFAULT_MODELS.filter(m => m.categories?.includes('image-and-text-to-text') || m.categories?.includes('image-to-text'));
export const TEXT_TO_IMAGE_MODELS = DEFAULT_MODELS.filter(m => m.categories?.includes('text-to-image'));
export const VERIFIED_MODELS = DEFAULT_MODELS;

function getCategoryIcon(categories = []) {
  if (categories.includes('text-to-image') || categories.includes('image-to-image')) {
    return <ImageIcon size={14} color="#ec4899" />;
  }
  if (categories.includes('image-and-text-to-text') || categories.includes('image-to-text')) {
    return <Eye size={14} color="#10b981" />;
  }
  if (categories.includes('text-to-speech') || categories.includes('speech-to-text-and-audio-understanding')) {
    return <Radio size={14} color="#8b5cf6" />;
  }
  if (categories.includes('any-to-any-multimodal')) {
    return <Sparkles size={14} color="#10b981" />;
  }
  return <MessageSquare size={14} color="#10b981" />;
}

export default function ModelSelector({
  selectedModelId = 'gemini-2.5-flash',
  onSelectModel,
  disabled = false
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [models, setModels] = useState(DEFAULT_MODELS);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadModels() {
      try {
        setLoading(true);
        const data = await api.getRegistryModels();
        if (mounted && data?.models?.length > 0) {
          // Prepend auto router if not present
          const autoModel = DEFAULT_MODELS.find(m => m.id === 'auto');
          const hasAuto = data.models.some(m => m.id === 'auto');
          setModels(hasAuto ? data.models : [autoModel, ...data.models]);
        }
      } catch (err) {
        console.warn('Using default verified model registry in selector:', err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadModels();
    return () => { mounted = false; };
  }, []);

  const handleClick = (event) => {
    if (!disabled) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearch('');
  };

  const handleSelect = (model) => {
    if (onSelectModel) {
      onSelectModel(model.id);
    }
    handleClose();
  };

  // Resolve current active model metadata
  const currentModel = models.find(m => {
    if (!m) return false;
    const target = (selectedModelId || 'gemini-2.5-flash').toLowerCase().trim();
    const id = (m.id || '').toLowerCase().trim();
    return id === target || id.includes(target) || target.includes(id);
  }) || models[0] || DEFAULT_MODELS[1];

  const isImageGen = currentModel?.categories?.includes('text-to-image');
  const isVision = currentModel?.categories?.includes('image-and-text-to-text') || currentModel?.categories?.includes('image-to-text');

  // Filter models by tab and search
  const filteredModels = models.filter(m => {
    if (!m) return false;

    // 1. Tab filter
    if (activeTab === 'text') {
      const isText = m.categories?.includes('text-generation-and-reasoning') && !m.categories?.includes('text-to-image');
      if (!isText && m.id !== 'auto') return false;
    } else if (activeTab === 'vision') {
      const isVis = m.categories?.includes('image-and-text-to-text') || m.categories?.includes('image-to-text') || m.categories?.includes('video-to-text-and-video-understanding');
      if (!isVis && m.id !== 'auto') return false;
    } else if (activeTab === 'image-gen') {
      const isImg = m.categories?.includes('text-to-image') || m.categories?.includes('image-to-image');
      if (!isImg && m.id !== 'auto') return false;
    } else if (activeTab === 'audio') {
      const isAud = m.categories?.includes('text-to-speech') || m.categories?.includes('speech-to-text-and-audio-understanding') || m.categories?.includes('audio-to-audio');
      if (!isAud && m.id !== 'auto') return false;
    }

    // 2. Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const name = (m.name || '').toLowerCase();
      const desc = (m.description || '').toLowerCase();
      const prov = (m.provider || '').toLowerCase();
      const id = (m.id || '').toLowerCase();
      return name.includes(q) || desc.includes(q) || prov.includes(q) || id.includes(q);
    }

    return true;
  });

  return (
    <Box>
      {/* Top Toolbar Trigger Button */}
      <Button
        onClick={handleClick}
        disabled={disabled}
        size="small"
        endIcon={<ChevronDown size={14} />}
        startIcon={
          loading ? (
            <CircularProgress size={12} color="inherit" />
          ) : (
            getCategoryIcon(currentModel?.categories)
          )
        }
        sx={{
          textTransform: 'none',
          color: 'text.primary',
          fontSize: '0.825rem',
          fontWeight: 600,
          px: 1.4,
          py: 0.5,
          borderRadius: 2,
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: isImageGen
            ? 'rgba(236, 72, 153, 0.4)'
            : (isVision ? 'rgba(16, 185, 129, 0.4)' : 'divider'),
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: 'action.hover',
            borderColor: isImageGen ? '#ec4899' : (isVision ? '#10b981' : '#10b981')
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Typography variant="body2" sx={{ fontWeight: 650, fontSize: '0.825rem', color: 'text.primary' }}>
            {currentModel?.name || 'Gemini 2.5 Flash'}
          </Typography>

          {/* Section Indicator Pill */}
          <Chip
            size="small"
            label={
              isImageGen
                ? 'Text to Image'
                : (isVision
                  ? 'Vision Multimodal'
                  : (currentModel?.providerId === 'ollama' ? 'Local Ollama' : 'Free Hosted'))
            }
            sx={{
              height: 18,
              fontSize: '0.625rem',
              fontWeight: 700,
              backgroundColor: isImageGen
                ? 'rgba(236, 72, 153, 0.12)'
                : (isVision ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)'),
              color: isImageGen ? '#ec4899' : '#059669',
              border: `1px solid ${isImageGen ? 'rgba(236, 72, 153, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`,
              display: { xs: 'none', sm: 'inline-flex' }
            }}
          />

          {/* Green Status Dot */}
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 6px rgba(16, 185, 129, 0.8)'
            }}
          />
        </Box>
      </Button>

      {/* Model Selection Dropdown Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 440,
            maxWidth: '95vw',
            maxHeight: 560,
            borderRadius: 3,
            mt: 1,
            boxShadow: '0 18px 48px rgba(0, 0, 0, 0.16)',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        {/* Menu Header with Category Tabs */}
        <Box sx={{ p: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Sparkles size={16} color="#10b981" />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.875rem' }}>
                Select AI Model (12 Categories)
              </Typography>
            </Box>
            <Chip
              label="Free Tiers Active"
              size="small"
              sx={{ height: 18, fontSize: '0.625rem', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}
            />
          </Box>

          {/* Search Box */}
          <TextField
            size="small"
            fullWidth
            placeholder="Search models, providers, modalities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={14} color="#9ca3af" />
                </InputAdornment>
              )
            }}
            sx={{ mb: 1, '& .MuiOutlinedInput-root': { height: 34, fontSize: '0.8rem' } }}
          />

          {/* Category Tabs */}
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 28,
              '& .MuiTab-root': {
                minHeight: 28,
                py: 0.2,
                px: 1,
                fontSize: '0.725rem',
                fontWeight: 650,
                textTransform: 'none'
              }
            }}
          >
            <Tab value="all" label="All" />
            <Tab value="text" label="Text & Code" />
            <Tab value="vision" label="Vision / Multimodal" />
            <Tab value="image-gen" label="Image Synthesis" />
            <Tab value="audio" label="Audio & Speech" />
          </Tabs>
        </Box>

        {/* Model List */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          {filteredModels.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                No models found matching your search.
              </Typography>
            </Box>
          ) : (
            filteredModels.map(model => {
              const isSelected = (currentModel?.id === model.id);
              return (
                <MenuItem
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  selected={isSelected}
                  sx={{
                    borderRadius: 2,
                    p: 1.2,
                    mb: 0.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    border: '1px solid',
                    borderColor: isSelected ? 'rgba(16, 185, 129, 0.4)' : 'transparent',
                    backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getCategoryIcon(model.categories)}
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary' }}>
                            {model.name}
                          </Typography>
                          {model.isRecommended && (
                            <Chip
                              label="Best"
                              size="small"
                              sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }}>
                          {model.provider} • {model.id}
                        </Typography>
                      </Box>
                    </Box>

                    {isSelected && <Check size={16} color="#10b981" />}
                  </Box>

                  {/* Quota & Latency info bar */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.8, pt: 0.6, borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <ShieldCheck size={12} color="#10b981" />
                      <Typography variant="caption" sx={{ fontSize: '0.675rem', fontWeight: 600, color: '#047857' }}>
                        {model.verifiedQuota || 'Free Tier'}
                      </Typography>
                    </Box>

                    {model.latencyMs && (
                      <Chip
                        icon={<Zap size={9} color="#f59e0b" />}
                        label={`~${model.latencyMs}ms`}
                        size="small"
                        sx={{ height: 16, fontSize: '0.6rem', fontWeight: 600, backgroundColor: 'action.hover' }}
                      />
                    )}
                  </Box>
                </MenuItem>
              );
            })
          )}
        </Box>
      </Menu>
    </Box>
  );
}
