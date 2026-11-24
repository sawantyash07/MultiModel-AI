import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Divider,
  Grid,
  Tooltip,
  Paper,
  Alert
} from '@mui/material';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  ShieldCheck,
  Layers,
  Key,
  Calendar,
  AlertTriangle,
  Globe,
  HardDrive,
  MessageSquare
} from 'lucide-react';

export default function ModelDetailsDialog({
  open,
  model,
  onClose,
  onSelectForChat
}) {
  const [copied, setCopied] = useState(false);

  if (!model) return null;

  const handleCopyId = () => {
    if (model.id) {
      navigator.clipboard.writeText(model.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusBadge = () => {
    const s = model.availabilityStatus?.toUpperCase() || 'READY';
    if (s === 'AVAILABLE' || s === 'READY') {
      return {
        label: 'Ready to Use',
        bgColor: 'rgba(16, 185, 129, 0.12)',
        textColor: '#10b981',
        borderColor: 'rgba(16, 185, 129, 0.3)'
      };
    }
    if (s === 'UNCONFIGURED' || s === 'CONFIG_REQUIRED') {
      return {
        label: 'API Key Required',
        bgColor: 'rgba(245, 158, 11, 0.12)',
        textColor: '#f59e0b',
        borderColor: 'rgba(245, 158, 11, 0.3)'
      };
    }
    return {
      label: s,
      bgColor: 'rgba(156, 163, 175, 0.12)',
      textColor: '#9ca3af',
      borderColor: 'rgba(156, 163, 175, 0.3)'
    };
  };

  const status = getStatusBadge();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.18)',
          overflow: 'hidden'
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.02) 100%)',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.1rem'
            }}
          >
            {model.provider ? model.provider[0].toUpperCase() : 'AI'}
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.2rem', color: 'text.primary' }}>
                {model.name}
              </Typography>
              <Chip
                label={status.label}
                size="small"
                sx={{
                  backgroundColor: status.bgColor,
                  color: status.textColor,
                  border: `1px solid ${status.borderColor}`,
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  height: 22
                }}
              />
              {model.isRecommended && (
                <Chip
                  icon={<Sparkles size={12} color="#10b981" />}
                  label="Recommended"
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: '#059669',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    height: 22
                  }}
                />
              )}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Provider: <strong>{model.provider}</strong> ({model.providerId}) • Verified: {model.verifiedDate || 'Oct 2026'}
            </Typography>
          </Box>
        </Box>

        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Model ID Bar */}
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: 2,
            backgroundColor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', minWidth: 64 }}>
              MODEL ID:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                fontWeight: 600,
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {model.id}
            </Typography>
          </Box>
          <Tooltip title={copied ? 'Copied!' : 'Copy Model Identifier'}>
            <IconButton size="small" onClick={handleCopyId} sx={{ color: copied ? '#10b981' : 'text.secondary' }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </IconButton>
          </Tooltip>
        </Paper>

        {/* Description */}
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, fontSize: '0.92rem' }}>
          {model.description}
        </Typography>

        {/* Categories & Modalities */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Layers size={16} color="#10b981" /> Assigned Categories
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                {model.categories?.map(cat => (
                  <Chip
                    key={cat}
                    label={cat}
                    size="small"
                    sx={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#047857', fontWeight: 600 }}
                  />
                ))}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Zap size={16} color="#3b82f6" /> Supported Modalities
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, width: 55, color: 'text.secondary' }}>
                    INPUT:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {model.supportedInputModalities?.map(m => (
                      <Chip key={m} label={m} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
                    ))}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, width: 55, color: 'text.secondary' }}>
                    OUTPUT:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {model.supportedOutputModalities?.map(m => (
                      <Chip key={m} label={m} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
                    ))}
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Free-Tier & Rate Limit Truth Box */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 2,
            borderColor: 'rgba(16, 185, 129, 0.3)',
            backgroundColor: 'rgba(16, 185, 129, 0.03)'
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#047857', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShieldCheck size={18} color="#10b981" /> Verified Free-Tier Quota & Rate Limits
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Free Access Type</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{model.freeAccessType || 'Free Tier'}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Verified Allowance</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#059669' }}>{model.verifiedQuota || 'Unknown'}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Reset Period</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{model.resetPeriod || 'Sliding Window'}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Cost After Free</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{model.costAfterFree || '$0.00'}</Typography>
            </Grid>
          </Grid>

          {model.rateLimits && Object.keys(model.rateLimits).length > 0 && (
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed rgba(16, 185, 129, 0.2)', display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {Object.entries(model.rateLimits).map(([key, val]) => (
                <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700, color: 'text.secondary' }}>
                    {key}:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {String(val)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>

        {/* Technical Specs */}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Zap size={16} color="#f59e0b" /> Technical Specifications
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Context Window</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {model.contextWindow ? `${Number(model.contextWindow).toLocaleString()} tokens` : 'Standard'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Max Output Tokens</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {model.maxOutputTokens ? `${Number(model.maxOutputTokens).toLocaleString()} tokens` : 'Standard'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Average Latency</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {model.latencyMs ? `~${model.latencyMs} ms` : 'Fast'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>Streaming SSE</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: model.streamingSupport ? '#10b981' : 'text.secondary' }}>
                {model.streamingSupport ? 'Supported' : 'Non-streaming'}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Credentials & Setup */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Key size={16} color="#6b7280" />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Required Secrets / Env:
            </Typography>
            {(!model.requiredEnvVars || model.requiredEnvVars.length === 0) ? (
              <Chip label="None (100% Free / Local)" size="small" sx={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontWeight: 700, height: 20 }} />
            ) : (
              model.requiredEnvVars.map(v => (
                <Chip key={v} label={v} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.675rem', fontFamily: 'monospace' }} />
              ))
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              License:
            </Typography>
            <Chip label={model.license || 'Open'} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.675rem' }} />
          </Box>
        </Box>
      </DialogContent>

      {/* Footer Actions */}
      <DialogActions
        sx={{
          p: 2,
          px: 3,
          backgroundColor: 'background.default',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {model.officialModelUrl && (
            <Button
              component="a"
              href={model.officialModelUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              startIcon={<ExternalLink size={14} />}
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              Model Hub
            </Button>
          )}
          {model.apiDocUrl && (
            <Button
              component="a"
              href={model.apiDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              startIcon={<ExternalLink size={14} />}
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              API Docs
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button onClick={onClose} sx={{ textTransform: 'none', color: 'text.secondary' }}>
            Close
          </Button>
          {onSelectForChat && (
            <Button
              variant="contained"
              onClick={() => {
                onSelectForChat(model.id);
                onClose();
              }}
              startIcon={<MessageSquare size={16} />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                backgroundColor: '#10b981',
                '&:hover': { backgroundColor: '#059669' },
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
              }}
            >
              Select for Chat
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
