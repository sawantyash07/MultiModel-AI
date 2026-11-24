import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  ShieldCheck,
  Play,
  Info,
  Layers
} from 'lucide-react';
import ModelDetailsDialog from './ModelDetailsDialog';

export default function ModelCard({
  model,
  isSelected = false,
  onSelect,
  onVerify,
  onSelectForChat
}) {
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleCopyId = (e) => {
    e.stopPropagation();
    if (model?.id) {
      navigator.clipboard.writeText(model.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async (e) => {
    e.stopPropagation();
    if (!onVerify || verifying) return;
    setVerifying(true);
    try {
      await onVerify(model.id);
    } finally {
      setVerifying(false);
    }
  };

  const getStatusBadge = () => {
    const s = (model?.availabilityStatus || model?.status || 'READY').toUpperCase();
    if (s === 'AVAILABLE' || s === 'READY') {
      return {
        label: 'Ready',
        bgColor: 'rgba(16, 185, 129, 0.12)',
        textColor: '#10b981',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        icon: <CheckCircle2 size={13} style={{ marginRight: 4 }} />
      };
    }
    if (s === 'UNCONFIGURED' || s === 'ACCESS_REQUIRED' || s === 'CONFIG_REQUIRED') {
      return {
        label: 'API Key Required',
        bgColor: 'rgba(245, 158, 11, 0.12)',
        textColor: '#f59e0b',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        icon: <Clock size={13} style={{ marginRight: 4 }} />
      };
    }
    return {
      label: s,
      bgColor: 'rgba(156, 163, 175, 0.12)',
      textColor: '#9ca3af',
      borderColor: 'rgba(156, 163, 175, 0.3)',
      icon: <AlertCircle size={13} style={{ marginRight: 4 }} />
    };
  };

  const statusBadge = getStatusBadge();

  return (
    <>
      <Card
        elevation={0}
        onClick={() => onSelect && onSelect(model)}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: isSelected ? '#10b981' : 'divider',
          backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.04)' : 'background.paper',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            borderColor: isSelected ? '#10b981' : 'rgba(16, 185, 129, 0.5)',
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.1)'
          }
        }}
      >
        <CardContent sx={{ p: 2.2, display: 'flex', flexDirection: 'column', flex: 1, gap: 1.3 }}>
          {/* Top Header: Name + Provider Badge + Status */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.96rem', lineHeight: 1.3, color: 'text.primary' }}>
                  {model.name}
                </Typography>
                {model.isRecommended && (
                  <Chip
                    icon={<Sparkles size={11} color="#059669" />}
                    label="Best"
                    size="small"
                    sx={{
                      height: 19,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      color: '#059669',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}
                  />
                )}
                {model.license && (
                  <Chip
                    label={model.license}
                    size="small"
                    variant="outlined"
                    sx={{ height: 19, fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary' }}
                  />
                )}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.2, fontWeight: 500 }}>
                {model.provider} {model.providerId && `(${model.providerId})`}
              </Typography>
            </Box>

            {/* Status Chip */}
            <Chip
              icon={statusBadge.icon}
              label={statusBadge.label}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 700,
                backgroundColor: statusBadge.bgColor,
                color: statusBadge.textColor,
                border: `1px solid ${statusBadge.borderColor}`
              }}
            />
          </Box>

          {/* Model ID Bar with Copy & External Link */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'action.hover',
              px: 1.2,
              py: 0.5,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.725rem',
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '80%'
              }}
            >
              {model.id}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title={copied ? 'Copied Model ID!' : 'Copy Model ID'}>
                <IconButton size="small" onClick={handleCopyId} sx={{ p: 0.4, color: 'text.secondary' }}>
                  {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </IconButton>
              </Tooltip>
              {(model.officialModelUrl || model.hfUrl) && (
                <Tooltip title="View official model page">
                  <IconButton
                    size="small"
                    component="a"
                    href={model.officialModelUrl || model.hfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    sx={{ p: 0.4, color: 'text.secondary' }}
                  >
                    <ExternalLink size={14} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Description */}
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontSize: '0.8rem',
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {model.description}
          </Typography>

          {/* Modalities Chips */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
            {model.supportedInputModalities?.map(mod => (
              <Chip
                key={`in-${mod}`}
                label={`IN: ${mod}`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  color: '#2563eb',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}
              />
            ))}
            {model.supportedOutputModalities?.map(mod => (
              <Chip
                key={`out-${mod}`}
                label={`OUT: ${mod}`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  color: '#059669',
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}
              />
            ))}
          </Box>

          {/* Verified Quota & Rate Limit Badge */}
          <Box
            sx={{
              backgroundColor: 'rgba(16, 185, 129, 0.04)',
              p: 1,
              borderRadius: 1.5,
              border: '1px solid rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 0.8
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, overflow: 'hidden' }}>
              <ShieldCheck size={14} color="#10b981" />
              <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                <strong style={{ color: '#047857' }}>Quota:</strong> {model.verifiedQuota || 'Free Tier'}
              </Typography>
            </Box>

            {model.latencyMs && (
              <Chip
                icon={<Zap size={10} color="#f59e0b" />}
                label={`~${model.latencyMs}ms`}
                size="small"
                sx={{ height: 18, fontSize: '0.625rem', fontWeight: 600, backgroundColor: 'action.hover' }}
              />
            )}
          </Box>

          <Box sx={{ flex: 1 }} />
          <Divider sx={{ my: 0.3 }} />

          {/* Actions Bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.8 }}>
            <Button
              size="small"
              variant="text"
              onClick={(e) => {
                e.stopPropagation();
                setDetailsOpen(true);
              }}
              startIcon={<Info size={13} />}
              sx={{
                fontSize: '0.725rem',
                textTransform: 'none',
                fontWeight: 600,
                color: 'text.secondary',
                p: 0.4
              }}
            >
              Specs & Quota
            </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              {onVerify && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleVerify}
                  disabled={verifying}
                  sx={{
                    borderRadius: 2,
                    fontSize: '0.725rem',
                    py: 0.3,
                    px: 1,
                    textTransform: 'none',
                    fontWeight: 600,
                    minWidth: 0
                  }}
                >
                  {verifying ? <CircularProgress size={12} /> : 'Test'}
                </Button>
              )}

              <Button
                size="small"
                variant={isSelected ? 'contained' : 'outlined'}
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectForChat) {
                    onSelectForChat(model.id);
                  } else if (onSelect) {
                    onSelect(model);
                  }
                }}
                startIcon={<Play size={12} />}
                sx={{
                  borderRadius: 2,
                  fontSize: '0.725rem',
                  py: 0.3,
                  px: 1.2,
                  textTransform: 'none',
                  fontWeight: 700,
                  backgroundColor: isSelected ? '#10b981' : 'transparent',
                  borderColor: '#10b981',
                  color: isSelected ? '#fff' : '#10b981',
                  '&:hover': {
                    backgroundColor: isSelected ? '#059669' : 'rgba(16, 185, 129, 0.08)',
                    borderColor: '#059669'
                  }
                }}
              >
                {isSelected ? 'Active' : 'Use in Chat'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <ModelDetailsDialog
        open={detailsOpen}
        model={model}
        onClose={() => setDetailsOpen(false)}
        onSelectForChat={onSelectForChat || ((id) => onSelect && onSelect(model))}
      />
    </>
  );
}
