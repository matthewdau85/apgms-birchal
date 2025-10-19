import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { fetchDashboard } from '../api/client';
import { DateText } from '../components/DateText';
import { Money } from '../components/Money';

export function DashboardPage() {
  const { data, isError, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => fetchDashboard(signal)
  });

  return (
    <section aria-labelledby="dashboard-heading" className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="dashboard-heading" className="text-2xl font-semibold tracking-tight">
            Treasury Dashboard
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Operational oversight for global payment governance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-brand-500 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          Refresh
        </button>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : !data || data.kpis.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section aria-label="Key performance indicators" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.kpis.map((kpi) => (
              <article
                key={kpi.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-500 dark:border-gray-800 dark:bg-gray-900"
              >
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">{kpi.label}</h2>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  <Money value={kpi.value} currency={kpi.currency ?? 'USD'} />
                </p>
                <p
                  className={`mt-1 text-sm font-medium ${
                    kpi.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {kpi.change >= 0 ? '+' : ''}
                  {kpi.change.toFixed(2)}%
                </p>
              </article>
            ))}
          </section>

          <section
            aria-label="30 day cash flow"
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">30-Day Movement</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Updated <DateText value={data.chart.at(-1)?.date ?? new Date().toISOString()} variant="short" />
              </p>
            </div>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chart} role="img" aria-label="30 day inflow and outflow chart">
                  <defs>
                    <linearGradient id="inflow" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outflow" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ borderRadius: 12 }}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: number) => [new Intl.NumberFormat().format(value), 'USD']}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="inflow" stroke="#16a34a" fill="url(#inflow)" name="Inflow" />
                  <Area type="monotone" dataKey="outflow" stroke="#dc2626" fill="url(#outflow)" name="Outflow" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" role="status" aria-live="polite">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-4 h-8 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-2 h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
      <div className="md:col-span-2 xl:col-span-4">
        <div className="mt-4 h-80 animate-pulse rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
      <h2 className="text-lg font-semibold">No dashboard data yet</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Connect your treasury sources to populate KPI metrics and cash movement trends.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
      <h2 className="text-lg font-semibold">We couldn't load the dashboard.</h2>
      <p className="mt-2 text-sm">{message}</p>
      <button
        type="button"
        className="mt-4 inline-flex items-center rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}
