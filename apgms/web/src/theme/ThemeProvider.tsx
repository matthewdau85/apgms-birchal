import React, { createContext, ReactNode, useContext, useMemo } from 'react';
import { defaultTheme, Theme } from './theme';

type ThemeContextValue = Theme;

const ThemeContext = createContext<ThemeContextValue>(defaultTheme);

export type ThemeProviderProps = {
  theme?: Partial<Theme>;
  children: ReactNode;
};

export const ThemeProvider = ({ theme, children }: ThemeProviderProps) => {
  const mergedTheme = useMemo<Theme>(
    () => ({
      ...defaultTheme,
      ...theme,
      colors: { ...defaultTheme.colors, ...(theme?.colors ?? {}) },
      spacing: { ...defaultTheme.spacing, ...(theme?.spacing ?? {}) },
      typography: { ...defaultTheme.typography, ...(theme?.typography ?? {}) },
      radii: { ...defaultTheme.radii, ...(theme?.radii ?? {}) },
      shadows: { ...defaultTheme.shadows, ...(theme?.shadows ?? {}) },
    }),
    [theme]
  );

  return <ThemeContext.Provider value={mergedTheme}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
