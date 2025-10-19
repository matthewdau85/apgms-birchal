import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { fetchJSON } from '../api/client';
import { useTheme } from '../theme/theme-provider';

export type DashboardKpi = {
  label: string;
  value: number | string;
  change?: number;
};

export type DashboardChartPoint = {
  date: string;
  value: number;
};

type DashboardResponse = {
  kpis?: DashboardKpi[];
  chart?: DashboardChartPoint[];
};

export function Dashboard() {
  const { theme } = useTheme();
  const { data, isLoading, isError, error } = useQuery<DashboardResponse | null>({
    queryKey: ['dashboard'],
    queryFn: () => fetchJSON<DashboardResponse>('/dashboard')
  });

  const kpis = data?.kpis ?? [];
  const chart = data?.chart ?? [];
  const axisColor = theme === 'dark' ? '#cbd5f5' : '#64748b';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? 'rgb(15 23 42)' : 'white',
    border: 'none',
    borderRadius: '0.5rem',
    color: theme === 'dark' ? 'white' : 'rgb(15 23 42)'
  };

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 id="dashboard-heading" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Key performance indicators and recent trends.</p>
        </div>
      </div>

      {isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error instanceof Error ? error.message : 'Unable to load dashboard data.'}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(isLoading ? Array.from({ length: 4 }) : kpis).map((item, index) => (
          <div
            key={item ? item.label : index}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            {item ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{formatValue(item.value)}</p>
                {typeof item.change === 'number' ? (
                  <p className={item.change >= 0 ? 'text-sm text-emerald-600' : 'text-sm text-rose-500'}>
                    {item.change >= 0 ? '+' : ''}
                    {item.change.toFixed(1)}%
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="h-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" aria-hidden="true" />
            )}
          </div>
        ))}
        {kpis.length === 0 && !isLoading ? (
          <p className="col-span-full text-sm text-slate-500 dark:text-slate-400">No KPIs available.</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">30-day trend</h2>
        </div>
        <div className="h-72">
          {isLoading ? (
            <div className="h-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" aria-hidden="true" />
          ) : chart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="date" stroke={axisColor} />
                <YAxis stroke={axisColor} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="value" stroke="#2563eb" fill="url(#colorValue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              No chart data available.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function formatValue(value: number | string) {
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return value;
}
