import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  Tooltip
} from '@mui/material';
import { Languages, ChevronDown, Search, Check } from 'lucide-react';
import { SCHEDULED_LANGUAGES, findLanguageByCode } from '../services/languageRegistry';

export default function LanguageSelectorBar({ selectedLanguage = 'en', onSelectLanguage, disabled = false }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [search, setSearch] = useState('');
  const open = Boolean(anchorEl);

  const current = findLanguageByCode(selectedLanguage) || SCHEDULED_LANGUAGES[0];

  const filtered = SCHEDULED_LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.nativeLabel.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (code) => {
    onSelectLanguage(code);
    setAnchorEl(null);
    setSearch('');
  };

  return (
    <>
      <Tooltip title={`Current Language: ${current.name} (${current.nativeLabel}) - Click to change`}>
        <Button
          size="small"
          variant="outlined"
          disabled={disabled}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          startIcon={<Languages size={14} color="#10b981" />}
          endIcon={<ChevronDown size={13} style={{ opacity: 0.7 }} />}
          sx={{
            height: 32,
            px: 1.2,
            fontSize: '0.78rem',
            fontWeight: 650,
            borderRadius: 2,
            borderColor: 'divider',
            backgroundColor: 'background.card',
            color: 'text.primary',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'background.hover'
            }
          }}
        >
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 18,
              borderRadius: '4px',
              backgroundColor: 'rgba(16, 185, 129, 0.14)',
              color: 'primary.main',
              fontSize: '0.675rem',
              fontWeight: 800,
              mr: 0.6,
              letterSpacing: '0.02em'
            }}
          >
            {current.code.toUpperCase()}
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>
            {current.name}
          </Box>
        </Button>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => {
          setAnchorEl(null);
          setSearch('');
        }}
        PaperProps={{
          sx: {
            width: 280,
            maxHeight: 380,
            p: 1,
            borderRadius: 3
          }
        }}
      >
        <Box sx={{ px: 0.5, pb: 1 }}>
          <TextField
            autoFocus
            size="small"
            fullWidth
            placeholder="Search language..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={14} color="#10b981" />
                </InputAdornment>
              ),
              sx: {
                height: 32,
                fontSize: '0.8rem',
                borderRadius: 2
              }
            }}
          />
        </Box>

        <Box sx={{ maxHeight: 290, overflowY: 'auto' }}>
          {filtered.map((lang) => {
            const isSelected = lang.code === selectedLanguage;
            return (
              <MenuItem
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                selected={isSelected}
                sx={{
                  borderRadius: 1.5,
                  py: 0.7,
                  px: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 26,
                      height: 20,
                      borderRadius: '4px',
                      backgroundColor: isSelected ? 'primary.main' : 'background.hover',
                      color: isSelected ? '#ffffff' : 'text.secondary',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800
                    }}
                  >
                    {lang.code.toUpperCase()}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.825rem' }}>
                      {lang.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                      {lang.nativeLabel}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  {lang.status === 'production' && (
                    <Chip
                      size="small"
                      label="HQ"
                      sx={{
                        height: 16,
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981'
                      }}
                    />
                  )}
                  {isSelected && <Check size={14} color="#10b981" />}
                </Box>
              </MenuItem>
            );
          })}
        </Box>
      </Menu>
    </>
  );
}
