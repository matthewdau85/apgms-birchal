import React from 'react';
import { Card, MetricTile } from '../components';
import { useTheme } from '../theme/ThemeProvider';

type ActivityItem = {
  id: string;
  label: string;
  timestamp: string;
  actor: string;
};

const activityFeed: ActivityItem[] = [
  {
    id: 'act-1',
    label: 'Syndicated RPT approved for Series B',
    timestamp: '2 hours ago',
    actor: 'J. Cole · Risk',
  },
  {
    id: 'act-2',
    label: 'Updated liquidity waterfall for FY24',
    timestamp: 'Yesterday',
    actor: 'M. Byrne · Treasury',
  },
  {
    id: 'act-3',
    label: 'Bank line utilisation nudged to 78%',
    timestamp: 'Monday',
    actor: 'System alert',
  },
];

const metrics = [
  { id: 'm1', label: 'Total runway', value: '21.4 months', delta: '+3.2 months', trend: 'up' as const },
  { id: 'm2', label: 'Cash on hand', value: '$84.2m', delta: '+$5.1m', trend: 'up' as const },
  { id: 'm3', label: 'Burn multiple', value: '0.7×', delta: '-0.1', trend: 'down' as const },
  { id: 'm4', label: 'Counterparty exposure', value: '32%', delta: 'Stable', trend: 'flat' as const },
];

export const DashboardPage = () => {
  const theme = useTheme();

  return (
    <div style={{ display: 'grid', gap: theme.spacing.xl }}>
      <section
        style={{
          display: 'grid',
          gap: theme.spacing.lg,
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        {metrics.map((metric) => (
          <MetricTile key={metric.id} label={metric.label} value={metric.value} delta={metric.delta} trend={metric.trend} />
        ))}
      </section>

      <Card title="Liquidity plan" subtitle="Consolidated targets across all managed entities">
        <div
          style={{
            display: 'grid',
            gap: theme.spacing.md,
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          }}
        >
          <div>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>Target coverage</p>
            <strong style={{ fontSize: 24 }}>18 months</strong>
          </div>
          <div>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>Scenario stress</p>
            <strong style={{ fontSize: 24 }}>-12%</strong>
          </div>
          <div>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>Mitigation toolkit</p>
            <strong style={{ fontSize: 24 }}>5 playbooks</strong>
          </div>
        </div>
      </Card>

      <Card title="Latest activity" subtitle="Keep an eye on risk participation events and comments">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: theme.spacing.md }}>
          {activityFeed.map((item) => (
            <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'grid', gap: theme.spacing.xs }}>
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                <span style={{ color: theme.colors.textSecondary }}>{item.actor}</span>
              </div>
              <span style={{ color: theme.colors.textSecondary }}>{item.timestamp}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
