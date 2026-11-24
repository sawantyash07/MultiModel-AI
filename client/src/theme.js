import { createTheme } from '@mui/material/styles';

/**
 * Yash AI Design System Theme Tokens
 * Clean, modern, distraction-free aesthetic with emerald-green accent branding.
 */
export const getAppTheme = (mode = 'light') => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#10b981',       // Crisp Emerald Green
        light: '#34d399',      // Soft Mint
        dark: '#059669',       // Deep Forest Emerald
        contrastText: '#ffffff'
      },
      secondary: {
        main: '#6366f1',
        light: '#818cf8',
        dark: '#4f46e5',
        contrastText: '#ffffff'
      },
      emerald: {
        50: '#ecfdf5',
        100: '#d1fae5',
        200: '#a7f3d0',
        300: '#6ee7b7',
        400: '#34d399',
        500: '#10b981',
        600: '#059669',
        700: '#047857',
        800: '#065f46',
        900: '#064e3b'
      },
      background: {
        default: isDark ? '#090d16' : '#f8fafc',
        paper: isDark ? '#111827' : '#ffffff',
        sidebar: isDark ? '#0d131f' : '#ffffff',
        rail: isDark ? '#080c14' : '#f8fafc',
        elevated: isDark ? '#161f30' : '#ffffff',
        composer: isDark ? 'rgba(17, 24, 39, 0.95)' : '#ffffff',
        composerBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
        composerBorderFocus: '#10b981',
        userBubble: isDark ? '#1e293b' : '#f1f5f9',
        aiBubble: 'transparent',
        card: isDark ? '#131d2e' : '#ffffff',
        cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
        cardHoverBorder: isDark ? 'rgba(16, 185, 129, 0.5)' : '#10b981',
        hover: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(16, 185, 129, 0.05)'
      },
      text: {
        primary: isDark ? '#f8fafc' : '#0f172a',
        secondary: isDark ? '#94a3b8' : '#64748b',
        disabled: isDark ? '#64748b' : '#94a3b8'
      },
      divider: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.8)'
    },
    typography: {
      fontFamily: '"Inter", "Noto Sans Devanagari", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 14,
      h3: {
        fontWeight: 800,
        letterSpacing: '-0.03em',
        lineHeight: 1.2
      },
      h4: {
        fontWeight: 750,
        letterSpacing: '-0.025em',
        lineHeight: 1.25
      },
      h5: {
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1.3
      },
      h6: {
        fontWeight: 650,
        letterSpacing: '-0.015em',
        lineHeight: 1.35
      },
      subtitle1: {
        fontWeight: 600,
        letterSpacing: '-0.01em',
        lineHeight: 1.5
      },
      subtitle2: {
        fontWeight: 600,
        letterSpacing: '-0.01em',
        lineHeight: 1.5
      },
      body1: {
        fontSize: '0.935rem',
        lineHeight: 1.65,
        letterSpacing: '-0.005em'
      },
      body2: {
        fontSize: '0.85rem',
        lineHeight: 1.55,
        letterSpacing: '-0.005em'
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.4,
        letterSpacing: '0.01em'
      },
      button: {
        textTransform: 'none',
        fontWeight: 600
      }
    },
    shape: {
      borderRadius: 12
    },
    shadows: [
      'none',
      isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.04)',
      isDark ? '0 2px 6px rgba(0,0,0,0.35)' : '0 2px 6px rgba(0,0,0,0.05)',
      isDark ? '0 4px 12px rgba(0,0,0,0.45)' : '0 4px 12px rgba(0,0,0,0.06)',
      isDark ? '0 6px 18px rgba(0,0,0,0.55)' : '0 6px 18px rgba(0,0,0,0.07)',
      ...Array(20).fill(isDark ? '0 12px 32px rgba(0,0,0,0.65)' : '0 12px 32px rgba(0,0,0,0.08)')
    ],
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            boxShadow: 'none',
            textTransform: 'none',
            fontWeight: 600,
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            '&:hover': {
              boxShadow: 'none'
            }
          },
          containedPrimary: {
            backgroundColor: '#10b981',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#059669',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }
          },
          outlined: {
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(226, 232, 240, 0.9)',
            '&:hover': {
              borderColor: '#10b981',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.04)'
            }
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none'
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 550,
            borderRadius: 8
          }
        }
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            fontSize: '0.75rem',
            borderRadius: 8,
            padding: '5px 10px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
          }
        }
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.9)'}`,
            boxShadow: isDark
              ? '0 16px 36px rgba(0, 0, 0, 0.55)'
              : '0 16px 36px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0,0,0,0.03)',
            backdropFilter: 'blur(16px)',
            backgroundColor: isDark ? 'rgba(17, 24, 39, 0.96)' : 'rgba(255, 255, 255, 0.98)'
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 18,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(226, 232, 240, 0.9)'}`,
            boxShadow: isDark
              ? '0 24px 60px rgba(0, 0, 0, 0.7)'
              : '0 24px 60px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0,0,0,0.04)',
            backgroundImage: 'none'
          }
        }
      }
    }
  });
};
