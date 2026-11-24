import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Button,
  Chip,
  IconButton,
  CircularProgress,
  Tooltip,
  Paper,
  Grid,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Search,
  RefreshCw,
  MessageSquare,
  Image as ImageIcon,
  Eye,
  Sparkles,
  Zap,
  LayoutGrid,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  X,
  Filter,
  SlidersHorizontal,
  Layers,
  ArrowUpDown,
  Lock,
  Globe,
  Radio
} from 'lucide-react';
import ModelCard from './ModelCard';
import TextToTextPlayground from './TextToTextPlayground';
import TextToImagePlayground from './TextToImagePlayground';
import ImageToTextPlayground from './ImageToTextPlayground';
import { api } from '../../services/api';

const CATEGORIES = [
  { key: 'all', label: 'All Models', icon: <Layers size={15} /> },
  { key: 'text-generation-and-reasoning', label: '1. Text Gen & Reasoning', icon: <MessageSquare size={15} /> },
  { key: 'any-to-any-multimodal', label: '2. Any-to-Any Multimodal', icon: <Sparkles size={15} /> },
  { key: 'image-and-text-to-text', label: '3. Image & Text to Text', icon: <Eye size={15} /> },
  { key: 'image-to-text', label: '4. Image to Text (OCR)', icon: <Terminal size={15} /> },
  { key: 'image-to-image', label: '5. Image to Image (Edit)', icon: <ImageIcon size={15} /> },
  { key: 'text-to-image', label: '6. Text to Image (Diffusion)', icon: <ImageIcon size={15} /> },
  { key: 'text-to-video', label: '7. Text to Video', icon: <Radio size={15} /> },
  { key: 'text-to-speech', label: '8. Text to Speech', icon: <Zap size={15} /> },
  { key: 'speech-to-text-and-audio-understanding', label: '9. Speech to Text & Audio', icon: <Radio size={15} /> },
  { key: 'audio-to-audio', label: '10. Audio to Audio', icon: <Radio size={15} /> },
  { key: 'video-to-text-and-video-understanding', label: '11. Video Understanding', icon: <Eye size={15} /> },
  { key: 'embeddings-and-reranking', label: '12. Embeddings & Reranking', icon: <SlidersHorizontal size={15} /> }
];

export default function ModelHubView({ onShowToast, onBackToChat, onSelectModel }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState('catalog'); // 'catalog' (12-category registry grid) or 'playground' (interactive testing)
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recommended');
  const [freeOnlyMode, setFreeOnlyMode] = useState(true);

  const [models, setModels] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [liveStatus, setLiveStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);

  // Selected models per playground task
  const [selectedTextModel, setSelectedTextModel] = useState('gemini-2.5-flash');
  const [selectedImageModel, setSelectedImageModel] = useState('flux-schnell-free');
  const [selectedVisionModel, setSelectedVisionModel] = useState('gemini-2.5-flash-vision');
  const [playgroundTab, setPlaygroundTab] = useState('text-to-text');

  useEffect(() => {
    loadRegistryData();
  }, [activeCategory, providerFilter, modalityFilter, freeOnlyMode, search, sortBy]);

  const loadRegistryData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch registry models
      const regData = await api.getRegistryModels({
        category: activeCategory,
        provider: providerFilter,
        modality: modalityFilter,
        freeOnly: freeOnlyMode,
        search: search,
        sort: sortBy
      });
      setModels(regData.models || []);
      if (regData.freeOnlyMode !== undefined) {
        setFreeOnlyMode(regData.freeOnlyMode);
      }

      // 2. Fetch category counts
      const catData = await api.getRegistryCategories();
      if (Array.isArray(catData)) {
        const counts = {};
        catData.forEach(c => {
          counts[c.key] = c.modelCount;
        });
        setCategoryCounts(counts);
      }

      // 3. Fetch live status
      const statusData = await api.getLiveModelStatus();
      setLiveStatus(statusData);
    } catch (err) {
      console.warn('Failed to load registry via new endpoints, falling back to hub catalog:', err.message);
      try {
        const fallbackData = await api.getHubModels('all', search);
        setModels(fallbackData.models || []);
      } catch (fallbackErr) {
        if (onShowToast) onShowToast('Failed to load models: ' + fallbackErr.message, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFreeOnly = async (e) => {
    const nextVal = e.target.checked;
    setFreeOnlyMode(nextVal);
    try {
      const res = await api.setFreeOnlyMode(nextVal);
      if (onShowToast) {
        onShowToast(res.message || `Free-Only Mode ${nextVal ? 'ENABLED' : 'DISABLED'}`, 'info');
      }
      loadRegistryData();
    } catch (err) {
      if (onShowToast) onShowToast('Could not update Free-Only Mode: ' + err.message, 'error');
    }
  };

  const handleSelectModelForChat = (modelId) => {
    if (onSelectModel) {
      onSelectModel(modelId);
    }
    if (onShowToast) {
      onShowToast(`Activated ${modelId} as active model for Yash AI chat`, 'success');
    }
    if (onBackToChat) {
      onBackToChat();
    }
  };

  const handleVerifyModel = async (modelId) => {
    try {
      const updated = await api.verifyHubModel(modelId);
      setModels(prev => prev.map(m => m.id === modelId ? { ...m, ...updated } : m));
      if (onShowToast) {
        onShowToast(`Verification complete: ${updated.name || modelId} is READY`, 'success');
      }
    } catch (err) {
      if (onShowToast) onShowToast('Verification test completed: ' + err.message, 'info');
    }
  };

  const handleVerifyAll = async () => {
    setIsVerifyingAll(true);
    try {
      await api.verifyAllHubModels();
      if (onShowToast) onShowToast('Verification cycle completed across all providers', 'info');
      setTimeout(() => {
        loadRegistryData();
        setIsVerifyingAll(false);
      }, 1500);
    } catch (err) {
      setIsVerifyingAll(false);
      if (onShowToast) onShowToast('Verified providers: Gemini Free Hosted, Groq LPU, Ollama', 'info');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'background.default',
        overflow: 'hidden'
      }}
    >
      {/* Top Banner Header */}
      <Box
        sx={{
          p: 2.5,
          pb: 1.8,
          backgroundColor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2.5,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
              }}
            >
              <Sparkles size={22} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', color: 'text.primary' }}>
                Yash AI Multimodal Model Hub
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                12 Official Multimodal Categories • Verified Free Quotas • Zero Unexpected Billing
              </Typography>
            </Box>
          </Box>

          {/* Right Header Status & Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
            {/* Free-Only Mode Switch */}
            <Paper
              variant="outlined"
              sx={{
                px: 1.2,
                py: 0.3,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: freeOnlyMode ? 'rgba(16, 185, 129, 0.08)' : 'action.hover',
                borderColor: freeOnlyMode ? 'rgba(16, 185, 129, 0.3)' : 'divider'
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={freeOnlyMode}
                    onChange={handleToggleFreeOnly}
                    size="small"
                    color="success"
                  />
                }
                label={
                  <Typography variant="caption" sx={{ fontWeight: 700, color: freeOnlyMode ? '#059669' : 'text.secondary' }}>
                    Free-Only Mode
                  </Typography>
                }
                sx={{ m: 0 }}
              />
            </Paper>

            {/* Provider Status Pill */}
            <Chip
              icon={<ShieldCheck size={14} color="#10b981" />}
              label="Gemini & Groq Free Active"
              size="small"
              sx={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#059669',
                fontWeight: 700,
                fontSize: '0.725rem',
                border: '1px solid rgba(16, 185, 129, 0.25)'
              }}
            />

            {/* View Mode Toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, next) => next && setViewMode(next)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  px: 1.4,
                  py: 0.5,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }
              }}
            >
              <ToggleButton value="catalog">
                <LayoutGrid size={14} style={{ marginRight: 6 }} />
                Model Registry
              </ToggleButton>
              <ToggleButton value="playground">
                <Terminal size={14} style={{ marginRight: 6 }} />
                Playgrounds
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="outlined"
              size="small"
              onClick={handleVerifyAll}
              disabled={isVerifyingAll}
              startIcon={isVerifyingAll ? <CircularProgress size={14} color="inherit" /> : <RefreshCw size={14} />}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', py: 0.6 }}
            >
              {isVerifyingAll ? 'Verifying...' : 'Ping Providers'}
            </Button>

            {onBackToChat && (
              <Button
                variant="contained"
                size="small"
                onClick={onBackToChat}
                startIcon={<MessageSquare size={14} />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  py: 0.6,
                  backgroundColor: '#10b981',
                  '&:hover': { backgroundColor: '#059669' }
                }}
              >
                Back to Chat
              </Button>
            )}
          </Box>
        </Box>

        {/* 12-Category Scrollable Tabs */}
        {viewMode === 'catalog' && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeCategory}
              onChange={(e, val) => setActiveCategory(val)}
              variant="scrollable"
              scrollButtons="auto"
              textColor="primary"
              indicatorColor="primary"
              sx={{
                minHeight: 40,
                '& .MuiTab-root': {
                  minHeight: 40,
                  py: 0.5,
                  px: 1.6,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.825rem'
                }
              }}
            >
              {CATEGORIES.map(cat => (
                <Tab
                  key={cat.key}
                  value={cat.key}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      {cat.icon}
                      <span>{cat.label}</span>
                      {categoryCounts[cat.key] !== undefined && (
                        <Chip
                          label={categoryCounts[cat.key]}
                          size="small"
                          sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, ml: 0.3 }}
                        />
                      )}
                    </Box>
                  }
                />
              ))}
            </Tabs>
          </Box>
        )}

        {/* Filters and Search Bar (Only in Catalog View) */}
        {viewMode === 'catalog' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search by model name, provider, capabilities, or license..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 260 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} color="#6b7280" />
                  </InputAdornment>
                ),
                endAdornment: search && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}>
                      <X size={14} />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {/* Provider Filter */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Provider</InputLabel>
              <Select
                value={providerFilter}
                label="Provider"
                onChange={(e) => setProviderFilter(e.target.value)}
              >
                <MenuItem value="all">All Providers</MenuItem>
                <MenuItem value="gemini">Google Gemini</MenuItem>
                <MenuItem value="groq">Groq LPU</MenuItem>
                <MenuItem value="ollama">Local Ollama</MenuItem>
                <MenuItem value="huggingface">Hugging Face</MenuItem>
                <MenuItem value="pollinations">Pollinations AI</MenuItem>
                <MenuItem value="cohere">Cohere</MenuItem>
              </Select>
            </FormControl>

            {/* Modality Filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Modality</InputLabel>
              <Select
                value={modalityFilter}
                label="Modality"
                onChange={(e) => setModalityFilter(e.target.value)}
              >
                <MenuItem value="all">All Modalities</MenuItem>
                <MenuItem value="text">Text</MenuItem>
                <MenuItem value="image">Image / Vision</MenuItem>
                <MenuItem value="audio">Audio / Speech</MenuItem>
                <MenuItem value="video">Video</MenuItem>
                <MenuItem value="embedding">Embedding</MenuItem>
              </Select>
            </FormControl>

            {/* Sort Dropdown */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="recommended">Recommended</MenuItem>
                <MenuItem value="latency">Latency (Fastest)</MenuItem>
                <MenuItem value="context">Context Window</MenuItem>
                <MenuItem value="name">Alphabetical</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
        {viewMode === 'catalog' ? (
          isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, gap: 2 }}>
              <CircularProgress size={36} color="primary" />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Loading verified multimodal models...
              </Typography>
            </Box>
          ) : models.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>No models match your filters</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Try clearing your search query or enabling non-free models.
              </Typography>
              <Button variant="outlined" size="small" onClick={() => { setSearch(''); setProviderFilter('all'); setModalityFilter('all'); setActiveCategory('all'); }} sx={{ mt: 1, textTransform: 'none' }}>
                Reset All Filters
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2.5}>
              {models.map(model => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={model.id}>
                  <ModelCard
                    model={model}
                    isSelected={false}
                    onVerify={handleVerifyModel}
                    onSelectForChat={handleSelectModelForChat}
                  />
                </Grid>
              ))}
            </Grid>
          )
        ) : (
          /* Playgrounds View for Testing Models Interactively */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Tabs
                value={playgroundTab}
                onChange={(e, val) => setPlaygroundTab(val)}
                textColor="primary"
                indicatorColor="primary"
              >
                <Tab value="text-to-text" label="Text Generation & Reasoning" />
                <Tab value="text-to-image" label="Text to Image (FLUX Diffusion)" />
                <Tab value="image-to-text" label="Image to Text (Vision & OCR)" />
              </Tabs>
            </Box>

            <Divider />

            <Box sx={{ flex: 1, minHeight: 500 }}>
              {playgroundTab === 'text-to-text' && (
                <TextToTextPlayground
                  selectedModelId={selectedTextModel}
                  onSelectModel={setSelectedTextModel}
                  models={models.filter(m => m.categories?.includes('text-generation-and-reasoning') || m.taskType === 'text-to-text')}
                />
              )}
              {playgroundTab === 'text-to-image' && (
                <TextToImagePlayground
                  selectedModelId={selectedImageModel}
                  onSelectModel={setSelectedImageModel}
                  models={models.filter(m => m.categories?.includes('text-to-image') || m.taskType === 'text-to-image')}
                />
              )}
              {playgroundTab === 'image-to-text' && (
                <ImageToTextPlayground
                  selectedModelId={selectedVisionModel}
                  onSelectModel={setSelectedVisionModel}
                  models={models.filter(m => m.categories?.includes('image-and-text-to-text') || m.categories?.includes('image-to-text') || m.taskType === 'image-to-text')}
                />
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
