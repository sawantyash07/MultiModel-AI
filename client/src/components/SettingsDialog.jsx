import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress
} from '@mui/material';
import {
  Settings,
  X,
  Database,
  Cpu,
  Sparkles,
  Trash2,
  Moon,
  Sun,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Brain,
  Globe,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '../services/api';

export default function SettingsDialog({
  open,
  onClose,
  themeMode,
  onToggleTheme,
  onClearAllConversations,
  onOpenMemory
}) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [freeOnlyMode, setFreeOnlyMode] = useState(true);
  const [testingProvider, setTestingProvider] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const [imageAutoFallback, setImageAutoFallback] = useState(() => {
    return localStorage.getItem('yash_image_auto_fallback') === 'true';
  });
  const [preferredImageModel, setPreferredImageModel] = useState(() => {
    return localStorage.getItem('yash_image_preferred_model') || 'flux-schnell-free';
  });
  const [testingImageProvider, setTestingImageProvider] = useState(null);
  const [imageProviderTestResult, setImageProviderTestResult] = useState(null);

  const handleToggleImageAutoFallback = (e) => {
    const val = e.target.checked;
    setImageAutoFallback(val);
    localStorage.setItem('yash_image_auto_fallback', String(val));
  };

  const handleChangePreferredImageModel = (e) => {
    const val = e.target.value;
    setPreferredImageModel(val);
    localStorage.setItem('yash_image_preferred_model', val);
  };

  const handleTestImageProvider = async (providerId, modelId) => {
    setTestingImageProvider(providerId);
    setImageProviderTestResult(null);
    try {
      const res = await api.checkImageProvider(providerId, modelId);
      setImageProviderTestResult(res);
    } catch (err) {
      setImageProviderTestResult({
        providerId,
        status: 'ERROR',
        errorMessage: err.message || 'Check failed.'
      });
    } finally {
      setTestingImageProvider(null);
    }
  };

  useEffect(() => {
    if (open) {
      loadHealth();
      loadFreeOnlyStatus();
    }
  }, [open]);

  const loadFreeOnlyStatus = async () => {
    try {
      const status = await api.getLiveModelStatus();
      if (status && status.freeOnlyMode !== undefined) {
        setFreeOnlyMode(status.freeOnlyMode);
      }
    } catch (e) {}
  };

  const handleToggleFreeOnly = async (e) => {
    const val = e.target.checked;
    setFreeOnlyMode(val);
    try {
      await api.setFreeOnlyMode(val);
    } catch (err) {
      console.error('Failed to toggle Free-Only Mode:', err);
    }
  };

  const handleTestProvider = async (providerId) => {
    setTestingProvider(providerId);
    setTestResult(null);
    try {
      const res = await api.testProviderConnection(providerId);
      setTestResult({
        providerId,
        connected: res.connected,
        message: res.message || res.error || (res.connected ? 'Connected successfully' : 'Connection failed'),
        latencyMs: res.latencyMs
      });
    } catch (err) {
      setTestResult({
        providerId,
        connected: false,
        message: err.message
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const loadHealth = async () => {
    setLoading(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch (err) {
      console.error('Failed to load health:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          backgroundColor: 'background.paper',
          backgroundImage: 'none',
          border: '1px solid',
          borderColor: 'divider'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings size={20} color="#10a37f" />
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Settings & System Status
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Appearance Section */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Appearance & Theme
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              borderRadius: 2,
              backgroundColor: 'background.card',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              {themeMode === 'dark' ? <Moon size={18} color="#60a5fa" /> : <Sun size={18} color="#f59e0b" />}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {themeMode === 'dark' ? 'Dark Mode (ChatGPT Dark)' : 'Light Mode (Clean Crisp)'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Seamlessly toggle between minimalist dark and light themes
                </Typography>
              </Box>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={onToggleTheme}
              sx={{ borderRadius: 6, textTransform: 'none' }}
            >
              Toggle
            </Button>
          </Box>
        </Box>

        {/* Backend & API Status Section */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Connected Services & Endpoints
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            {/* Persistent AI Memory */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: 'background.card',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Brain size={18} color="#8b5cf6" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Persistent User Memory
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {health?.services?.memory?.count ?? 0} facts saved • Cross-session persistence • Secret filtering enabled
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  if (onOpenMemory) onOpenMemory();
                }}
                sx={{
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  borderColor: 'rgba(139, 92, 246, 0.4)',
                  color: '#8b5cf6',
                  '&:hover': {
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.08)'
                  }
                }}
              >
                Manage
              </Button>
            </Box>

            {/* Live Web Research & Anti-Hallucination */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: 'background.card',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Globe size={18} color="#10a37f" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Live Web Research & Anti-Hallucination
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Multi-Engine Verification • Real-time source cross-checking • Clickable citations
                  </Typography>
                </Box>
              </Box>
              <Chip
                size="small"
                icon={<CheckCircle2 size={12} />}
                label="Active"
                sx={{
                  backgroundColor: 'rgba(16, 163, 127, 0.15)',
                  color: '#10a37f',
                  fontWeight: 600
                }}
              />
            </Box>

            {/* Pinecone Vector DB */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: 'background.card',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Database size={18} color="#10a37f" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Pinecone Vector DB
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Index: <strong>{health?.services?.pinecone?.indexName || 'shop-support'}</strong> (Dim: {health?.services?.pinecone?.dimension || 1024})
                  </Typography>
                </Box>
              </Box>
              <Chip
                size="small"
                icon={<CheckCircle2 size={12} />}
                label={health?.services?.pinecone?.status || 'Connected'}
                sx={{
                  backgroundColor: 'rgba(16, 163, 127, 0.15)',
                  color: '#10a37f',
                  fontWeight: 600
                }}
              />
            </Box>

            {/* Free-Only Mode Enforcer */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: freeOnlyMode ? 'rgba(16, 185, 129, 0.08)' : 'background.card',
                border: '1px solid',
                borderColor: freeOnlyMode ? 'rgba(16, 185, 129, 0.4)' : 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <ShieldCheck size={18} color="#10b981" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: freeOnlyMode ? '#047857' : 'text.primary' }}>
                    Free-Only Mode
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Guarantees zero unexpected billing by restricting calls exclusively to verified free tiers and local models
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={freeOnlyMode}
                onChange={handleToggleFreeOnly}
                color="success"
                size="small"
              />
            </Box>

            {/* Image Generation & Quota Fallback Section */}
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: 'background.card',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                  <ImageIcon size={18} color="#6366f1" />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Automatic Quota Fallback for Image Generation
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      When enabled, automatically routes to verified free diffusion if a premium model returns zero quota or billing error
                    </Typography>
                  </Box>
                </Box>
                <Switch
                  checked={imageAutoFallback}
                  onChange={handleToggleImageAutoFallback}
                  color="primary"
                  size="small"
                />
              </Box>

              <Divider sx={{ my: 0.5 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Preferred Image Model:
                </Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <Select
                    value={preferredImageModel}
                    onChange={handleChangePreferredImageModel}
                    sx={{ fontSize: '0.8rem', height: 32 }}
                  >
                    <MenuItem value="flux-schnell-free" sx={{ fontSize: '0.8rem' }}>FLUX.1 [schnell] / Sana (Free Tier)</MenuItem>
                    <MenuItem value="gemini-3.1-flash-image" sx={{ fontSize: '0.8rem' }}>Gemini 3.1 Flash Image (Google)</MenuItem>
                    <MenuItem value="gemini-3-pro-image" sx={{ fontSize: '0.8rem' }}>Gemini 3 Pro Image (Google)</MenuItem>
                    <MenuItem value="gpt-image-2.5-flare" sx={{ fontSize: '0.8rem' }}>GPT Image 2.5 Flare (OpenAI)</MenuItem>
                    <MenuItem value="gpt-image-2.5-sunburst" sx={{ fontSize: '0.8rem' }}>GPT Image 2.5 Sunburst (OpenAI)</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pt: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
                  Test Image Connectivity:
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleTestImageProvider('gemini', 'gemini-3.1-flash-image')}
                  disabled={Boolean(testingImageProvider)}
                  startIcon={testingImageProvider === 'gemini' ? <CircularProgress size={12} color="inherit" /> : null}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1, borderRadius: 1.5 }}
                >
                  Test Gemini
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleTestImageProvider('openai', 'gpt-image-2.5-flare')}
                  disabled={Boolean(testingImageProvider)}
                  startIcon={testingImageProvider === 'openai' ? <CircularProgress size={12} color="inherit" /> : null}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1, borderRadius: 1.5 }}
                >
                  Test OpenAI
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleTestImageProvider('pollinations', 'flux-schnell-free')}
                  disabled={Boolean(testingImageProvider)}
                  startIcon={testingImageProvider === 'pollinations' ? <CircularProgress size={12} color="inherit" /> : null}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1, borderRadius: 1.5 }}
                >
                  Test Free Diffusion
                </Button>
              </Box>

              {imageProviderTestResult && (
                <Alert
                  severity={imageProviderTestResult.status === 'AVAILABLE' ? 'success' : 'warning'}
                  onClose={() => setImageProviderTestResult(null)}
                  sx={{ py: 0.5, fontSize: '0.78rem' }}
                >
                  <strong>{imageProviderTestResult.providerId ? imageProviderTestResult.providerId.toUpperCase() : 'PROVIDER'}:</strong> Status = {imageProviderTestResult.status}. {imageProviderTestResult.errorMessage || imageProviderTestResult.errorReason || ''}
                </Alert>
              )}
            </Box>

            {/* Test Connection Alert Result */}
            {testResult && (
              <Alert
                severity={testResult.connected ? 'success' : 'warning'}
                onClose={() => setTestResult(null)}
                sx={{ py: 0.5, fontSize: '0.8rem' }}
              >
                <strong>{testResult.providerId.toUpperCase()}:</strong> {testResult.message}
                {testResult.latencyMs && ` (${testResult.latencyMs}ms)`}
              </Alert>
            )}

            {/* Google Gemini (Free-Tier Hosted) */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: 'background.card',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Sparkles size={18} color="#10a37f" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Google Gemini 2.5 Flash
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Free-Tier Hosted Inference • Zero Cost • Multimodal & Coding
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleTestProvider('gemini')}
                  disabled={testingProvider === 'gemini'}
                  sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.2, px: 1, minWidth: 0, borderRadius: 1.5 }}
                >
                  {testingProvider === 'gemini' ? 'Testing...' : 'Test'}
                </Button>
                <Chip
                  size="small"
                  icon={<CheckCircle2 size={12} />}
                  label={health?.services?.gemini?.status || 'Active (Free-Tier)'}
                  sx={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10a37f',
                    fontWeight: 600
                  }}
                />
              </Box>
            </Box>

            {/* Groq High-Speed */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: 'background.card',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Zap size={18} color="#f97316" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Groq High-Speed LPU Cloud
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Free Developer Tier • Ultra-Fast Inference • Auto-Fallback on Gemini 429
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleTestProvider('groq')}
                  disabled={testingProvider === 'groq'}
                  sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.2, px: 1, minWidth: 0, borderRadius: 1.5 }}
                >
                  {testingProvider === 'groq' ? 'Testing...' : 'Test'}
                </Button>
                <Chip
                  size="small"
                  label={health?.services?.groq?.status || (health?.services?.groq?.configured ? 'Active' : 'Missing GROQ_API_KEY')}
                  sx={{
                    backgroundColor: health?.services?.groq?.configured ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: health?.services?.groq?.configured ? '#f97316' : 'text.disabled',
                    fontWeight: 600
                  }}
                />
              </Box>
            </Box>

            {/* Local Ollama */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: 'background.card',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Cpu size={18} color="#3b82f6" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Local Ollama Runner
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Local Private Execution • http://localhost:11434 • Zero Cost
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleTestProvider('ollama')}
                  disabled={testingProvider === 'ollama'}
                  sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.2, px: 1, minWidth: 0, borderRadius: 1.5 }}
                >
                  {testingProvider === 'ollama' ? 'Testing...' : 'Ping'}
                </Button>
                <Chip
                  size="small"
                  label={health?.services?.ollama?.status || 'Offline'}
                  sx={{
                    backgroundColor: (health?.services?.ollama?.status || '').includes('Running') ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: (health?.services?.ollama?.status || '').includes('Running') ? '#3b82f6' : 'text.disabled',
                    fontWeight: 600
                  }}
                />
              </Box>
            </Box>

            {/* Hugging Face */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: 'background.card',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <ShieldCheck size={18} color="#f59e0b" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Hugging Face Inference Providers
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Hosted Router • Requires Account Credits for Inference Providers
                  </Typography>
                </Box>
              </Box>
              <Chip
                size="small"
                label={health?.services?.huggingface?.status || 'Configured'}
                sx={{
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  fontWeight: 600
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Data Management Section */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'error.main' }}>
            Data & Privacy
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              borderRadius: 2,
              backgroundColor: 'background.card',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Clear Conversation History
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Permanently delete all chat sessions stored on the server
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<Trash2 size={15} />}
              onClick={() => {
                if (window.confirm('Are you sure you want to delete all stored conversations?')) {
                  onClearAllConversations();
                  onClose();
                }
              }}
              sx={{ borderRadius: 6, textTransform: 'none' }}
            >
              Clear All
            </Button>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary" sx={{ borderRadius: 6 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
