import { colors, spacing, typography, radii, shadows } from './tokens';

export type Theme = {
  colors: typeof colors;
  spacing: typeof spacing;
  typography: typeof typography;
  radii: typeof radii;
  shadows: typeof shadows;
};

export const defaultTheme: Theme = {
  colors,
  spacing,
  typography,
  radii,
  shadows,
};
