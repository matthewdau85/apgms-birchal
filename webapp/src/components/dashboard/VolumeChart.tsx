import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Card } from '../ui/Card';
import styles from './VolumeChart.module.css';
import type { TimeSeriesDatum } from '../../data/dashboardData';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

type VolumeChartProps = {
  data: TimeSeriesDatum[];
};

export const VolumeChart = ({ data }: VolumeChartProps) => {
  const chartData = useMemo(() => data ?? [], [data]);

  return (
    <Card className={styles.chartCard}>
      <header className={styles.header}>
        <div>
          <p className={styles.label}>30-day Originations Volume</p>
          <p className={styles.value}>{formatCurrency(chartData.at(-1)?.value ?? 0)}</p>
        </div>
      </header>
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={25} />
            <YAxis
              tickFormatter={(value) => `$${(value / 1_000_000).toFixed(1)}M`}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface-secondary)',
                borderRadius: '0.75rem',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)'
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-accent)"
              fill="url(#colorVolume)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
