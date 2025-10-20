import React, { CSSProperties } from 'react';
import { Card } from '../components';
import { BankLineSummary } from '../components/RPTDrawer';
import { useTheme } from '../theme/ThemeProvider';

type BankLinesPageProps = {
  onSelectLine: (line: BankLineSummary) => void;
};

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const bankLines: BankLineSummary[] = [
  {
    id: 'BL-2034',
    provider: 'Silicon Valley Bank UK',
    currency: 'GBP',
    limit: 45000000,
    utilised: 31200000,
    renewalDate: '30 Jun 2024',
    relationshipManager: 'Sophie Martins',
  },
  {
    id: 'BL-2078',
    provider: 'HSBC Innovation',
    currency: 'USD',
    limit: 60000000,
    utilised: 22400000,
    renewalDate: '12 Sep 2024',
    relationshipManager: 'Daniel Bryant',
  },
  {
    id: 'BL-2101',
    provider: 'Judo Bank',
    currency: 'AUD',
    limit: 32000000,
    utilised: 28400000,
    renewalDate: '05 Nov 2024',
    relationshipManager: 'Amelia Stone',
  },
];

export const BankLinesPage = ({ onSelectLine }: BankLinesPageProps) => {
  const theme = useTheme();

  return (
    <div style={{ display: 'grid', gap: theme.spacing.xl }}>
      <Card title="Risk participation overview" subtitle="Monitor active and proposed bank partnerships">
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: theme.typography.body.lg.size,
          }}
        >
          <thead>
            <tr style={{ color: theme.colors.textSecondary, textAlign: 'left' }}>
              <th style={{ paddingBottom: theme.spacing.sm }}>Provider</th>
              <th style={{ paddingBottom: theme.spacing.sm }}>Currency</th>
              <th style={{ paddingBottom: theme.spacing.sm }}>Committed</th>
              <th style={{ paddingBottom: theme.spacing.sm }}>Utilised</th>
              <th style={{ paddingBottom: theme.spacing.sm }}>Renewal</th>
              <th style={{ paddingBottom: theme.spacing.sm }}>
                <span style={visuallyHidden}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bankLines.map((line) => {
              const utilisation = Math.round((line.utilised / line.limit) * 100);
              return (
                <tr key={line.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <td style={{ padding: `${theme.spacing.sm}px 0` }}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <strong>{line.provider}</strong>
                      <span style={{ color: theme.colors.textSecondary }}>{line.id}</span>
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing.sm}px 0` }}>{line.currency}</td>
                  <td style={{ padding: `${theme.spacing.sm}px 0` }}>{line.limit.toLocaleString()}</td>
                  <td style={{ padding: `${theme.spacing.sm}px 0` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                      <span>{line.utilised.toLocaleString()}</span>
                      <div
                        aria-hidden
                        style={{
                          flex: 1,
                          height: 6,
                          background: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: theme.radii.pill,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${utilisation}%`,
                            background: utilisation > 85 ? theme.colors.warning : theme.colors.primary,
                            height: '100%',
                          }}
                        />
                      </div>
                      <span style={{ color: theme.colors.textSecondary }}>{utilisation}%</span>
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing.sm}px 0` }}>{line.renewalDate}</td>
                  <td style={{ padding: `${theme.spacing.sm}px 0`, textAlign: 'right' }}>
                    <button
                      onClick={() => onSelectLine(line)}
                      style={{
                        padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                        borderRadius: theme.radii.md,
                        border: 'none',
                        background: theme.colors.primary,
                        color: '#02040B',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      View RPT
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title="Playbook" subtitle="Suggested actions based on utilisation thresholds">
        <ol style={{ margin: 0, paddingLeft: theme.spacing.xl, display: 'grid', gap: theme.spacing.sm }}>
          <li>Engage SVB UK for upsized tranche before end of Q2.</li>
          <li>Confirm HSBC Innovation renewal clauses with treasury counsel.</li>
          <li>Review AUD hedging posture with Judo Bank relationship team.</li>
        </ol>
      </Card>
    </div>
  );
};
