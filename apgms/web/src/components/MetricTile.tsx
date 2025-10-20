import React from 'react';
import { useTheme } from '../theme/ThemeProvider';

type MetricTileProps = {
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
};

export const MetricTile = ({ label, value, delta, trend = 'flat' }: MetricTileProps) => {
  const theme = useTheme();

  const trendColor =
    trend === 'up'
      ? theme.colors.success
      : trend === 'down'
      ? theme.colors.danger
      : theme.colors.textSecondary;

  const trendSymbol = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '◆';

  return (
    <div
      style={{
        borderRadius: theme.radii.lg,
        padding: theme.spacing.lg,
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.surface,
        display: 'grid',
        gap: theme.spacing.sm,
      }}
    >
      <span
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: theme.typography.body.sm.size,
          color: theme.colors.textSecondary,
        }}
      >
        {label}
      </span>
      <strong
        style={{
          fontSize: 28,
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {value}
      </strong>
      {delta && (
        <span style={{ color: trendColor, fontSize: theme.typography.body.md.size }}>
          {trendSymbol} {delta}
        </span>
      )}
    </div>
  );
};
