import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Link
} from '@mui/material';
import {
  Globe,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';

export default function WebSearchView({ onSendToChat, onShowToast }) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async (targetQuery) => {
    const q = (targetQuery || query).trim();
    if (!q) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.searchWeb(q, 6);
      setResults(data);
    } catch (err) {
      setError(err.message || 'Web search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.verifyFacts(query.trim());
      setResults(data);
    } catch (err) {
      setError(err.message || 'Fact verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const sampleQueries = [
    'Latest updates on AI regulation and open weights models',
    'MEMS micropump biomedical applications and clinical trials',
    'Java 21 Virtual Threads and Project Loom production benchmarks',
    'ISRO upcoming space missions and Chandrayaan breakthroughs'
  ];

  return (
    <Box
      sx={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        backgroundColor: 'background.default',
        p: { xs: 2, sm: 4 },
        maxWidth: 1000,
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
            <Globe size={18} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 750, letterSpacing: '-0.02em' }}>
            Live Web Search & Fact Verification
          </Typography>
          <Chip
            size="small"
            label="Anti-Hallucination Engine"
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
          Perform live internet research across multi-engine indexes with verified source attribution.
        </Typography>
      </Box>

      {/* Search Input Card */}
      <Card
        variant="outlined"
        sx={{
          p: 2.5,
          borderRadius: 3.5,
          borderColor: 'background.cardBorder',
          backgroundColor: 'background.card',
          backdropFilter: 'blur(16px)',
          mb: 3.5,
          boxShadow: '0 8px 30px rgba(16, 185, 129, 0.08)'
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search the live web or enter a claim to verify..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 2,
              '& fieldset': { borderColor: 'divider' }
            }}
          />
          <Button
            variant="contained"
            color="primary"
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <Search size={16} />}
            disabled={isLoading || !query.trim()}
            onClick={() => handleSearch()}
            sx={{ px: 3, borderRadius: 2, fontWeight: 650, flexShrink: 0 }}
          >
            Search Web
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ShieldCheck size={16} />}
            disabled={isLoading || !query.trim()}
            onClick={handleVerify}
            sx={{ px: 2.5, borderRadius: 2, fontWeight: 650, flexShrink: 0 }}
          >
            Verify Fact
          </Button>
        </Box>

        {/* Sample queries */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            Trending:
          </Typography>
          {sampleQueries.map((s, idx) => (
            <Chip
              key={idx}
              size="small"
              label={s}
              clickable
              onClick={() => {
                setQuery(s);
                handleSearch(s);
              }}
              sx={{
                fontSize: '0.72rem',
                backgroundColor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': { borderColor: 'primary.main', backgroundColor: 'background.hover' }
              }}
            />
          ))}
        </Box>
      </Card>

      {/* Error state */}
      {error && (
        <Card variant="outlined" sx={{ p: 2, mb: 3, borderColor: 'error.main', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
            <AlertCircle size={18} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{error}</Typography>
          </Box>
        </Card>
      )}

      {/* Results List */}
      {results && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Search Sources & Citations ({results.sources?.length || results.results?.length || 0})
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<MessageSquare size={14} />}
              onClick={() =>
                onSendToChat?.(
                  `Based on live web research for "${query}":\n\n${(results.sources || results.results || [])
                    .map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet || s.content}`)
                    .join('\n\n')}\n\nPlease summarize the key insights.`
                )
              }
              sx={{ borderRadius: 2, fontSize: '0.75rem', fontWeight: 650 }}
            >
              Analyze in Chat
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(results.sources || results.results || []).map((source, idx) => (
              <Card
                key={idx}
                variant="outlined"
                sx={{
                  p: 2.2,
                  borderRadius: 3,
                  borderColor: 'background.cardBorder',
                  backgroundColor: 'background.card',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: 'primary.main', transform: 'translateY(-1px)' }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.925rem' }}>
                    {source.title || 'Web Result'}
                  </Typography>
                  {source.url && (
                    <Link
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem', color: 'primary.main' }}
                    >
                      Visit <ExternalLink size={12} />
                    </Link>
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.6, mb: 1.5 }}>
                  {source.snippet || source.content || 'No description available'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {source.source && (
                    <Chip
                      size="small"
                      label={source.source}
                      sx={{ height: 20, fontSize: '0.675rem', fontWeight: 600, backgroundColor: 'background.default' }}
                    />
                  )}
                  {source.score !== undefined && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                      Relevance: {Math.round(source.score * 100)}%
                    </Typography>
                  )}
                </Box>
              </Card>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
