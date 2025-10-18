import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { DataState } from '@/components/DataState';
import { Money } from '@/components/Money';
import { Skeleton } from '@/components/Skeleton';
import { fetchDashboardSummary } from '@/services/dashboard';

const DashboardRoute = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
    staleTime: 60_000,
  });

  const chartData = useMemo(() => data?.chart ?? [], [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <DataState
        tone="error"
        title="We hit a snag loading the dashboard."
        description="Please refresh the page or try again in a few minutes."
        action={
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            Retry
          </button>
        }
      />
    );
  }

  if (!data) {
    return (
      <DataState
        title="No insights to display yet"
        description="Once transactions start flowing we will surface cash KPIs and runway information here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section aria-label="Key performance indicators" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <article
            key={metric.id}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{metric.label}</p>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-2xl font-semibold">
                {metric.id === 'utilization' ? (
                  <span className="font-mono tabular-nums">{(metric.value * 100).toFixed(1)}%</span>
                ) : metric.id === 'discrepancies' ? (
                  <span className="font-mono tabular-nums">{metric.value}</span>
                ) : (
                  <Money value={metric.value} />
                )}
              </span>
              <span
                className={`text-xs font-semibold ${
                  metric.trend === 'up'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
                aria-label={
                  metric.trend === 'up'
                    ? `${Math.abs(metric.delta)}% increase`
                    : `${Math.abs(metric.delta)}% decrease`
                }
              >
                {metric.trend === 'up' ? '▲' : '▼'} {Math.abs(metric.delta).toFixed(1)}%
              </span>
            </div>
          </article>
        ))}
      </section>

      <section
        aria-label="30-day working capital trend"
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">30-day working capital trend</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Rolling inflows and outflows across core payment corridors.</p>
          </div>
        </div>
        <div className="mt-6 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 8, right: 16, top: 20, bottom: 4 }}>
              <defs>
                <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => `$${(value / 1_000_000).toFixed(1)}M`}
                tick={{ fill: '#64748b', fontSize: 12 }}
                width={70}
              />
              <Tooltip
                formatter={(value: number) => [
                  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value),
                  value >= 0 ? 'Inflow' : 'Outflow',
                ]}
                labelFormatter={(value) =>
                  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                }
              />
              <Legend wrapperStyle={{ color: '#0f172a' }} />
              <Area
                type="monotone"
                dataKey="inflow"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#colorInflow)"
                name="Inflow"
              />
              <Area
                type="monotone"
                dataKey="outflow"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#colorOutflow)"
                name="Outflow"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

export default DashboardRoute;
