import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { TooltipProps } from 'recharts';

import { api } from '../lib/api';
import { Money } from '../ui/Money';
import { Skeleton } from '../ui/Skeleton';
import { Route as RootRoute } from './__root';

export type DashboardResponse = {
  summary: {
    cashOnHand: number;
    outstanding: number;
    verified: number;
    runRate: number;
  };
  trend: Array<{
    date: string;
    value: number;
  }>;
};

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isError, error, isLoading, isFetching } = useQuery<DashboardResponse>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get<DashboardResponse>('/dashboard');
      return response.data;
    },
  });

  return (
    <div className="flex h-full flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Welcome back</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Monitor balances, approvals, and revenue momentum in one view.
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Key metrics</h2>
        <DashboardSummary isLoading={isLoading} isFetching={isFetching} data={data?.summary} isError={isError} error={error} />
      </section>

      <section className="flex-1">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          30-day inflows
        </h2>
        <DashboardTrend isLoading={isLoading} data={data?.trend ?? []} />
      </section>
    </div>
  );
}

type DashboardSummaryProps = {
  isLoading: boolean;
  isFetching: boolean;
  data?: DashboardResponse['summary'];
  isError: boolean;
  error: unknown;
};

function DashboardSummary({ isLoading, isFetching, data, isError, error }: DashboardSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-6 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
        {(error as Error)?.message ?? 'Unable to load metrics right now.'}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No metrics available yet. Connect your first bank feed to unlock insights.
      </div>
    );
  }

  const cards = [
    {
      label: 'Cash on hand',
      value: <Money value={data.cashOnHand} />,
    },
    {
      label: 'Outstanding',
      value: <Money value={data.outstanding} />,
    },
    {
      label: 'Verified this month',
      value: <Money value={data.verified} />,
    },
    {
      label: 'Run rate',
      value: <Money value={data.runRate} />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-brand-50/40 p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-brand-900/20"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-50">{card.value}</p>
          {isFetching && <span className="absolute right-4 top-4 h-2 w-2 animate-ping rounded-full bg-brand-500" />}
        </article>
      ))}
    </div>
  );
}

type DashboardTrendProps = {
  isLoading: boolean;
  data: DashboardResponse['trend'];
};

function DashboardTrend({ isLoading, data }: DashboardTrendProps) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Connect more bank feeds to see rolling performance.
      </div>
    );
  }

  return (
    <div className="h-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-inner dark:border-slate-800 dark:bg-slate-900">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, bottom: 10, left: 0, right: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} />
          <YAxis strokeOpacity={0} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="value" stroke="hsl(235 86% 65%)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip(props: TooltipProps<number, string>) {
  if (!props.active || !props.payload?.length) {
    return null;
  }

  const [{ value, payload }] = props.payload;
  const formattedValue = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value ?? 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-900/90 px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-semibold">{payload?.date}</div>
      <div>{formattedValue}</div>
    </div>
  );
}
