import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem('apgms-theme') as Theme | null;
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  if (theme === 'dark') {
    root.classList.add('dark');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getPreferredTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem('apgms-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? 'dark' : 'light');
    };

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', handleMediaChange);

    return () => media.removeEventListener('change', handleMediaChange);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setThemeState((prev) => (prev === 'light' ? 'dark' : 'light')),
      setTheme: setThemeState
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
