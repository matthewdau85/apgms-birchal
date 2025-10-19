import React from 'react';
import DateText from './DateText';

export type ChartPoint = {
  date: string;
  value: number;
};

type LineChartProps = {
  data: ChartPoint[];
};

const LineChart: React.FC<LineChartProps> = ({ data }) => {
  if (!data.length) {
    return <p>No chart data.</p>;
  }

  const max = Math.max(...data.map((point) => point.value));
  const min = Math.min(...data.map((point) => point.value));
  const viewBoxHeight = max - min || 1;

  const path = data
    .map((point, index) => {
      const x = (index / Math.max(1, data.length - 1)) * 100;
      const y = ((max - point.value) / viewBoxHeight) * 100;
      return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
    })
    .join(' ');

  return (
    <div className="chart-container">
      <h2>Last 30 days</h2>
      <svg viewBox="0 0 100 100" role="img" aria-label="Cash flow over the last 30 days">
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(37, 99, 235, 0.35)" />
            <stop offset="100%" stopColor="rgba(37, 99, 235, 0.05)" />
          </linearGradient>
        </defs>
        <path d={`${path} L 100,100 L 0,100 Z`} fill="url(#area-fill)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--muted)' }}>
        <DateText value={data[0].date} formatOptions={{ month: 'short', day: 'numeric' }} />
        <DateText value={data[data.length - 1].date} formatOptions={{ month: 'short', day: 'numeric' }} />
      </div>
    </div>
  );
};

export default LineChart;
