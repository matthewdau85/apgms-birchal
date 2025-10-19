import { createRoute, Link } from '@tanstack/react-router';
import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import clsx from 'clsx';

import { fetchDashboard, type DashboardResponse } from '../lib/api';
import { AppRouterContext } from '../router';
import { Money } from '../ui/Money';
import { DateText } from '../ui/Date';
import { Route as rootRoute } from './__root';

const dashboardQueryOptions = queryOptions<DashboardResponse>({
  queryKey: ['dashboard'],
  queryFn: fetchDashboard,
  staleTime: 5 * 60 * 1000
});

const DashboardPage = () => {
  const { data } = useQuery(dashboardQueryOptions);

  if (!data?.kpis.length && !data?.cashTrend.length) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Operating dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Snapshot of cash, facilities and utilisation for the past month.
          </p>
        </div>
        {data?.asOf && (
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Updated <DateText value={data.asOf} className="ml-1" />
          </div>
        )}
      </header>

      <section aria-labelledby="kpi-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="kpi-heading" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Key indicators
          </h2>
          <Link
            to="/bank-lines"
            prefetch="intent"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-200"
          >
            Manage bank lines
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data?.kpis.map((kpi) => (
            <article
              key={kpi.id}
              className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:border-slate-300 focus-within:border-slate-300 dark:border-slate-800 dark:bg-slate-900/70"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">{kpi.label}</h3>
                  <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                    <Money value={kpi.value} />
                  </p>
                </div>
                {typeof kpi.delta === 'number' && kpi.deltaDirection && (
                  <Delta value={kpi.delta} direction={kpi.deltaDirection} />
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="trend-heading" className="space-y-4">
        <div>
          <h2 id="trend-heading" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            30 day cash trend
          </h2>
          <p className="sr-only" id="trend-description">
            Cash balance plotted for the previous 30 days.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div role="img" aria-labelledby="trend-heading trend-description" className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.cashTrend ?? []} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CBD5F5" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Intl.DateTimeFormat('en-AU', { month: 'short', day: 'numeric' }).format(new Date(value))}
                  stroke="#94A3B8"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94A3B8"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value)
                  }
                />
                <Tooltip content={<TrendTooltip />} />
                <Line type="monotone" dataKey="amount" stroke="#0EA5E9" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <TrendTable data={data?.cashTrend ?? []} />
        </div>
      </section>
    </div>
  );
};

const TrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-lg">
      <div className="font-medium">
        {new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(label))}
      </div>
      <div>
        {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(point.value as number)}
      </div>
    </div>
  );
};

const TrendTable = ({ data }: { data: DashboardResponse['cashTrend'] }) => (
  <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600 dark:divide-slate-800 dark:text-slate-300">
      <caption className="sr-only">Tabular representation of the cash trend</caption>
      <thead className="bg-slate-50/70 dark:bg-slate-800">
        <tr>
          <th scope="col" className="px-3 py-2 font-medium">Date</th>
          <th scope="col" className="px-3 py-2 font-medium">Balance</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
        {data.map((point) => (
          <tr key={point.date}>
            <td className="px-3 py-2">
              <DateText value={point.date} />
            </td>
            <td className="px-3 py-2">
              <Money value={point.amount} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Delta = ({ value, direction }: { value: number; direction: 'up' | 'down' }) => {
  const positive = direction === 'up';
  return (
    <p
      className={clsx(
        'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
        positive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-200'
      )}
    >
      <span aria-hidden>{positive ? '▲' : '▼'}</span>
      <span>
        {value}% {positive ? 'increase' : 'decrease'}
      </span>
    </p>
  );
};

const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center dark:border-slate-700 dark:bg-slate-900/60">
    <div className="text-4xl" aria-hidden>
      📈
    </div>
    <div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">No dashboard data yet</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        Connect a bank feed or import statements to populate the dashboard.
      </p>
    </div>
  </div>
);

const DashboardSkeleton = () => (
  <div className="space-y-8">
    <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-700/70" />
      ))}
    </div>
    <div className="h-80 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-700/70" />
  </div>
);

const DashboardError = ({ error }: { error: unknown }) => (
  <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
    <h2 className="text-lg font-semibold">Unable to load dashboard</h2>
    <p className="mt-2 text-sm">
      {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again shortly.'}
    </p>
  </div>
);

export const Route = createRoute<AppRouterContext>({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(dashboardQueryOptions);
    return {};
  },
  component: DashboardPage,
  pendingComponent: DashboardSkeleton,
  errorComponent: DashboardError
});

export { dashboardQueryOptions };
