import React from 'react';
import { useTheme } from '../theme/ThemeProvider';

type NavigationItem = {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
};

type NavigationProps = {
  items: NavigationItem[];
  activeItemId: string;
  onSelect: (id: string) => void;
};

export const Navigation = ({ items, activeItemId, onSelect }: NavigationProps) => {
  const theme = useTheme();

  return (
    <nav
      aria-label="Primary navigation"
      style={{ display: 'grid', gap: theme.spacing.sm }}
    >
      {items.map((item) => {
        const isActive = activeItemId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              justifyContent: 'space-between',
              padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
              background: isActive ? theme.colors.surfaceAlt : 'transparent',
              border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
              borderRadius: theme.radii.md,
              color: isActive ? theme.colors.textPrimary : theme.colors.textSecondary,
              cursor: 'pointer',
              transition: 'all 160ms ease',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              {item.icon && <span aria-hidden>{item.icon}</span>}
              <span>{item.label}</span>
            </span>
            {item.badge && (
              <span
                style={{
                  fontSize: theme.typography.body.sm.size,
                  padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                  background: theme.colors.primary,
                  color: '#02040B',
                  borderRadius: theme.radii.pill,
                  fontWeight: 600,
                }}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
