import React, { ReactNode } from 'react';
import { useTheme } from '../theme/ThemeProvider';

type HeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export const Header = ({ title, subtitle, actions }: HeaderProps) => {
  const theme = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
      }}
    >
      <div style={{ display: 'grid', gap: theme.spacing.xs }}>
        <h1
          style={{
            margin: 0,
            fontSize: theme.typography.headings.h1.size,
            fontWeight: theme.typography.headings.h1.weight,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: 0,
              color: theme.colors.textSecondary,
              fontSize: theme.typography.body.lg.size,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: theme.spacing.sm }}>{actions}</div>}
    </div>
  );
};
