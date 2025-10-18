import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Money } from '../components/Money';
import { apiFetch } from '../lib/api';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useMemo } from 'react';

const DASHBOARD_QUERY_KEY = ['dashboard'];

export type DashboardKpi = {
  id: string;
  label: string;
  value: number;
  change?: number | null;
};

export type DashboardTrendPoint = {
  date: string;
  value: number;
};

export type DashboardResponse = {
  kpis: DashboardKpi[];
  trend: DashboardTrendPoint[];
};

async function fetchDashboard() {
  return apiFetch<DashboardResponse>('/dashboard');
}

function useDashboard() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboard
  });
}

export default function DashboardRoute() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboard();

  const hasData = Boolean(data?.kpis?.length || data?.trend?.length);
  const trendData = useMemo(() => data?.trend ?? [], [data?.trend]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Aggregated performance across all products for the past 30 days.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      )}

      {isError && (
        <Card intent="danger">
          <CardHeader>
            <CardTitle>Unable to load dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && !hasData && (
        <Card>
          <CardHeader>
            <CardTitle>No metrics available yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Once transactions start flowing, you&apos;ll see aggregate metrics and trends here.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && hasData && (
        <>
          <section aria-label="Key performance indicators" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data?.kpis?.map((kpi) => (
              <Card key={kpi.id}>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {kpi.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Money value={kpi.value} className="text-2xl font-semibold" />
                  {typeof kpi.change === 'number' && (
                    <p
                      className={`text-sm font-medium ${kpi.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                    >
                      {kpi.change >= 0 ? '▲' : '▼'} {Math.abs(kpi.change).toFixed(1)}%
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </section>

          <section aria-label="30-day volume trend">
            <Card>
              <CardHeader>
                <CardTitle>Volume last 30 days</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <XAxis dataKey="date" stroke="currentColor" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis
                      stroke="currentColor"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      tickFormatter={(value) => `$${value / 1000}k`}
                    />
                    <Tooltip
                      cursor={{ stroke: 'hsl(222 47% 11% / 0.1)', strokeWidth: 2 }}
                      contentStyle={{
                        borderRadius: '0.5rem',
                        borderColor: 'rgb(226 232 240)',
                        backgroundColor: 'rgb(255 255 255)'
                      }}
                      labelClassName="font-medium"
                      formatter={(value: number) => [new Intl.NumberFormat().format(value), 'Volume']}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="rgb(99 102 241)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
