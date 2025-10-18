import React from 'react';
import { useTheme } from '../theme/ThemeProvider';

export type BankLineSummary = {
  id: string;
  provider: string;
  currency: string;
  limit: number;
  utilised: number;
  renewalDate: string;
  relationshipManager: string;
};

type RPTDrawerProps = {
  bankLine?: BankLineSummary | null;
  onClose: () => void;
};

export const RPTDrawer = ({ bankLine, onClose }: RPTDrawerProps) => {
  const theme = useTheme();

  if (!bankLine) {
    return (
      <div style={{ padding: theme.spacing.xl }}>
        <header style={{ marginBottom: theme.spacing.lg }}>
          <h2 style={{ margin: 0 }}>RPT Insights</h2>
          <p style={{ color: theme.colors.textSecondary }}>
            Select a bank line to review risk participation terms and exposures.
          </p>
        </header>
      </div>
    );
  }

  const utilisation = ((bankLine.utilised / bankLine.limit) * 100).toFixed(1);
  const remaining = bankLine.limit - bankLine.utilised;

  return (
    <div style={{ padding: theme.spacing.xl, display: 'grid', gap: theme.spacing.lg }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>{bankLine.provider}</h2>
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>Line ID · {bankLine.id}</p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii.md,
            color: theme.colors.textSecondary,
            padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </header>
      <section
        style={{
          display: 'grid',
          gap: theme.spacing.md,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radii.md,
          padding: theme.spacing.lg,
          background: theme.colors.surfaceAlt,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: theme.colors.textSecondary }}>Currency</span>
          <strong>{bankLine.currency}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: theme.colors.textSecondary }}>Committed limit</span>
          <strong>{bankLine.limit.toLocaleString()}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: theme.colors.textSecondary }}>Utilised</span>
          <strong>{bankLine.utilised.toLocaleString()}</strong>
        </div>
        <div
          style={{
            height: 6,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: theme.radii.pill,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${utilisation}%`,
              background: theme.colors.primary,
              height: '100%',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: theme.colors.textSecondary }}>
          <span>{utilisation}% utilised</span>
          <span>{remaining.toLocaleString()} remaining</span>
        </div>
      </section>
      <section
        style={{
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radii.md,
          padding: theme.spacing.lg,
          display: 'grid',
          gap: theme.spacing.md,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Relationship</h3>
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>{bankLine.relationshipManager}</p>
        </div>
        <div>
          <h3 style={{ margin: 0 }}>Renewal</h3>
          <p style={{ margin: 0, color: theme.colors.warning }}>{bankLine.renewalDate}</p>
        </div>
        <button
          style={{
            padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
            borderRadius: theme.radii.md,
            border: 'none',
            background: theme.colors.primary,
            color: '#02040B',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Generate latest RPT
        </button>
      </section>
    </div>
  );
};
