import React, { ReactNode } from 'react';
import { useTheme } from '../theme/ThemeProvider';

type CardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export const Card = ({ title, subtitle, children, footer }: CardProps) => {
  const theme = useTheme();

  return (
    <section
      style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radii.lg,
        padding: theme.spacing.lg,
        display: 'grid',
        gap: theme.spacing.md,
        boxShadow: theme.shadows.raised,
      }}
    >
      {(title || subtitle) && (
        <header style={{ display: 'grid', gap: theme.spacing.xs }}>
          {title && (
            <h2
              style={{
                margin: 0,
                fontSize: theme.typography.headings.h3.size,
                fontWeight: theme.typography.headings.h3.weight,
              }}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p
              style={{
                margin: 0,
                color: theme.colors.textSecondary,
                fontSize: theme.typography.body.md.size,
              }}
            >
              {subtitle}
            </p>
          )}
        </header>
      )}
      <div>{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  );
};
