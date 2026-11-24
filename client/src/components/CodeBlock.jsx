import React, { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Copy, Check } from 'lucide-react';

export default function CodeBlock({ language = '', value = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const displayLang = language ? language.toLowerCase() : 'code';

  return (
    <Box
      sx={{
        my: 2,
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: '#181818',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
      }}
    >
      {/* Code Header Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.7,
          backgroundColor: '#262626',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            color: '#a3a3a3',
            fontSize: '0.75rem',
            fontWeight: 500,
            textTransform: 'lowercase'
          }}
        >
          {displayLang}
        </Typography>

        <Button
          size="small"
          onClick={handleCopy}
          startIcon={copied ? <Check size={13} color="#10a37f" /> : <Copy size={13} />}
          sx={{
            color: copied ? '#10a37f' : '#a3a3a3',
            fontSize: '0.725rem',
            fontWeight: 500,
            py: 0.2,
            px: 1,
            borderRadius: '6px',
            '&:hover': {
              color: '#ffffff',
              backgroundColor: 'rgba(255, 255, 255, 0.08)'
            }
          }}
        >
          {copied ? 'Copied!' : 'Copy code'}
        </Button>
      </Box>

      {/* Code Text */}
      <Box
        component="pre"
        sx={{
          p: 2,
          m: 0,
          overflowX: 'auto',
          fontSize: '0.85rem',
          fontFamily: '"JetBrains Mono", monospace',
          color: '#f4f4f5',
          lineHeight: 1.6,
          backgroundColor: '#181818'
        }}
      >
        <code>{value}</code>
      </Box>
    </Box>
  );
}
