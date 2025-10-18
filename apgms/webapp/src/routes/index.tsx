import { useEffect, useMemo, useState } from 'react';
import { api, handleApiError } from '../lib/api';
import { Money } from '../ui/Money';
import { Skeleton } from '../ui/Skeleton';
import { DateText } from '../ui/DateText';

type DashboardMetric = {
  id: string;
  label: string;
  value: number;
  delta?: number;
  currency?: string;
};

type ChartPoint = {
  date: string;
  value: number;
};

type DashboardResponse = {
  metrics: DashboardMetric[];
  chart: ChartPoint[];
  generatedAt?: string;
};

type RequestState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: DashboardResponse | null;
  error?: string;
};

const emptyDashboard: DashboardResponse = {
  metrics: [],
  chart: [],
  generatedAt: undefined
};

const getFallbackDashboard = (): DashboardResponse => ({
  metrics: [
    { id: 'arr', label: 'ARR', value: 0, currency: 'USD' },
    { id: 'customers', label: 'Active Customers', value: 0 },
    { id: 'growth', label: '30d Growth', value: 0, delta: 0 }
  ],
  chart: [],
  generatedAt: undefined
});

export default function DashboardRoute() {
  const [{ status, data, error }, setState] = useState<RequestState>({
    status: 'idle',
    data: null
  });

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading', data: null });
    api
      .get<DashboardResponse>('/analytics/dashboard')
      .then((response) => {
        if (!isMounted) return;
        const payload = response.data ?? emptyDashboard;
        setState({ status: 'success', data: payload });
      })
      .catch((err) => {
        if (!isMounted) return;
        setState({ status: 'error', data: getFallbackDashboard(), error: handleApiError(err) });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const metrics = useMemo(() => data?.metrics ?? [], [data]);
  const chart = useMemo(() => data?.chart ?? [], [data]);
  const generatedAt = data?.generatedAt;

  const hasMetrics = metrics.length > 0;
  const hasChart = chart.length > 0;

  const maxChartValue = useMemo(() => {
    return chart.reduce((max, point) => (point.value > max ? point.value : max), 0);
  }, [chart]);

  const chartPath = useMemo(() => {
    if (!hasChart) {
      return '';
    }

    const width = chart.length > 1 ? chart.length - 1 : 1;
    const height = maxChartValue || 1;

    return chart
      .map((point, index) => {
        const x = (index / width) * 100;
        const y = height === 0 ? 100 : 100 - (point.value / height) * 100;
        return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');
  }, [chart, hasChart, maxChartValue]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Key Performance</h2>
          {generatedAt ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Refreshed <DateText value={generatedAt} />
            </p>
          ) : null}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {status === 'loading' &&
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`metric-skeleton-${index}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-8 w-32" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
            ))}

          {status !== 'loading' && hasMetrics ? (
            metrics.map((metric) => (
              <div
                key={metric.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-sm text-slate-500 dark:text-slate-400">{metric.label}</p>
                <div className="mt-3 flex items-baseline gap-2">
                  {typeof metric.currency === 'string' ? (
                    <Money
                      value={metric.value}
                      currency={metric.currency}
                      align="start"
                      className="text-2xl text-slate-900 dark:text-white"
                    />
                  ) : (
                    <span className="tabular-nums text-2xl font-semibold text-slate-900 dark:text-white">
                      {metric.value.toLocaleString()}
                    </span>
                  )}
                  {typeof metric.delta === 'number' ? (
                    <span
                      className={`text-xs font-semibold ${
                        metric.delta > 0
                          ? 'text-emerald-500'
                          : metric.delta < 0
                          ? 'text-rose-500'
                          : 'text-slate-500'
                      }`}
                    >
                      {metric.delta > 0 ? '+' : ''}
                      {metric.delta}%
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          ) : null}

          {status !== 'loading' && !hasMetrics ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              No performance data available.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">30-Day Cash Flow</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Daily settled volume</p>
          </div>
        </div>

        {status === 'loading' ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-52 w-full" />
          </div>
        ) : hasChart ? (
          <div className="mt-6">
            <svg viewBox="0 0 100 100" className="h-60 w-full">
              <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`${chartPath} L 100,100 L 0,100 Z`}
                fill="url(#chartGradient)"
                stroke="none"
              />
              <path d={chartPath} fill="none" stroke="#2563eb" strokeWidth={1.5} />
            </svg>
            <div className="mt-4 grid grid-cols-5 gap-2 text-xs text-slate-500 dark:text-slate-400">
              {chart.slice(0, 5).map((point) => (
                <div key={point.date} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/70">
                  <p className="font-medium text-slate-700 dark:text-slate-200">{new Date(point.date).getDate()}</p>
                  <p className="tabular-nums text-slate-500 dark:text-slate-400">{point.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Chart data will appear once transactions start flowing in.
          </div>
        )}
      </section>

      {status === 'error' ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}
