import React from 'react';
import clsx from 'clsx';
import { ChartPoint } from '../lib/api';

type TrendChartProps = {
  data: ChartPoint[];
  className?: string;
};

export function TrendChart({ data, className }: TrendChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">No chart data available.</p>;
  }

  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const gradientId = React.useId();

  const path = data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((point.value - min) / range) * 100;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  const areaPath = `${path} L100,100 L0,100 Z`;

  return (
    <figure className={clsx('w-full', className)}>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="Cash runway over the last 30 days"
        preserveAspectRatio="none"
        className="h-48 w-full overflow-visible rounded-lg bg-slate-100 text-indigo-500 dark:bg-slate-900"
      >
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <figcaption className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        30 days of daily balances.
      </figcaption>
    </figure>
  );
}
