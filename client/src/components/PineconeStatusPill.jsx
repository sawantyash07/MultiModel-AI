import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Popover,
  Chip,
  Divider,
  Button,
  IconButton
} from '@mui/material';
import { Database, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { api } from '../services/api';

export default function PineconeStatusPill() {
  const [status, setStatus] = useState({
    connected: true,
    indexName: 'shop-support',
    dimension: 1024,
    statusText: 'Connected'
  });
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await api.getHealth();
      if (data?.services?.pinecone) {
        const pc = data.services.pinecone;
        setStatus({
          connected: pc.status === 'Connected',
          indexName: pc.indexName || 'shop-support',
          dimension: pc.dimension || 1024,
          statusText: pc.status || 'Connected'
        });
      }
    } catch (_) {
      // Keep existing state or mark offline if backend is unreachable
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <Box
        onClick={handleOpen}
        sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          gap: 0.8,
          height: 32,
          px: 1.2,
          borderRadius: 2,
          backgroundColor: 'background.card',
          border: '1px solid',
          borderColor: status.connected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          userSelect: 'none',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'background.hover'
          }
        }}
      >
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: status.connected ? '#10b981' : '#f59e0b',
            boxShadow: status.connected ? '0 0 8px #10b981' : '0 0 8px #f59e0b',
            animation: status.connected ? 'pulseGlow 2.5s infinite' : 'none'
          }}
        />
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.74rem',
            fontWeight: 650,
            color: 'text.primary',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}
        >
          Pinecone
        </Typography>
        <Chip
          size="small"
          label={status.connected ? 'Live' : 'Degraded'}
          sx={{
            height: 16,
            fontSize: '0.6rem',
            fontWeight: 750,
            backgroundColor: status.connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            color: status.connected ? '#10b981' : '#f59e0b',
            border: 'none'
          }}
        />
      </Box>

      {/* Interactive Detail Popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{
          sx: {
            p: 2,
            width: 280,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 12px 30px rgba(0,0,0,0.15)'
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Database size={15} />
            </Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
              Pinecone Vector DB
            </Typography>
          </Box>
          <IconButton size="small" onClick={fetchStatus} disabled={loading} sx={{ p: 0.5 }}>
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
          </IconButton>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, lineHeight: 1.4 }}>
          Vector embeddings storage engine powering semantic retrieval and grounding.
        </Typography>

        <Divider sx={{ mb: 1.2 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Status
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircle2 size={13} color="#10b981" />
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#10b981' }}>
                {status.statusText}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Index Name
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 650, fontFamily: 'monospace' }}>
              {status.indexName}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Vector Dimension
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 650, fontFamily: 'monospace' }}>
              {status.dimension} (Cosine)
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Architecture
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 650 }}>
              Serverless AWS
            </Typography>
          </Box>
        </Box>
      </Popover>
    </>
  );
}
