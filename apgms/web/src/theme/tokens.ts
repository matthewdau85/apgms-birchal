export type ThemeTokens = typeof themeTokens;

export const themeTokens = {
  color: {
    background: '#0f172a',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    border: '#e2e8f0',
    accent: '#2563eb',
    accentMuted: '#60a5fa',
    destructive: '#dc2626',
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      inverted: '#ffffff',
      subtle: '#64748b',
    },
    focus: '#fbbf24',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
  },
  radius: {
    sm: '0.375rem',
    md: '0.75rem',
    full: '9999px',
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.7,
    },
    size: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
    },
  },
  shadow: {
    sm: '0 1px 2px rgba(15, 23, 42, 0.08)',
    md: '0 10px 30px rgba(15, 23, 42, 0.12)',
  },
} as const;
