import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_KEY = 'apgms-theme-mode';

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = window.localStorage.getItem(THEME_KEY) as ThemeMode | null;
    return stored ?? 'system';
  });

  const resolvedMode = mode === 'system' ? getSystemTheme() : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.dataset.colorMode = resolvedMode;
  }, [mode, resolvedMode]);

  useEffect(() => {
    if (mode !== 'system') {
      window.localStorage.setItem(THEME_KEY, mode);
    } else {
      window.localStorage.removeItem(THEME_KEY);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => {
      const root = document.documentElement;
      root.dataset.colorMode = event.matches ? 'dark' : 'light';
    };
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      setMode: setModeState
    }),
    [mode, resolvedMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
