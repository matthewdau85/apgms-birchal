import React, { useEffect, useState } from 'react';
import { fetchDashboardSummary, DashboardSummary } from '../lib/api';
import { Money } from '../ui/Money';
import { Skeleton } from '../ui/Skeleton';
import { TrendChart } from '../ui/TrendChart';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

type SummaryState = {
  status: LoadState;
  data?: DashboardSummary;
  error?: string;
};

const initialState: SummaryState = {
  status: 'idle'
};

export default function DashboardRoute() {
  const [state, setState] = useState<SummaryState>(initialState);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchDashboardSummary({ signal: controller.signal })
      .then((data) => {
        setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if ((error as DOMException)?.name === 'AbortError') return;
        setState({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      });
    return () => controller.abort();
  }, []);

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="space-y-8" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="mb-3 h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <Skeleton className="mb-4 h-4 w-48" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
        <h2 className="text-lg font-semibold">We could not load the dashboard.</h2>
        <p className="mt-2 text-sm">{state.error}</p>
        <button
          type="button"
          className="mt-4 inline-flex items-center rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
          onClick={() => {
            setState({ status: 'loading' });
            fetchDashboardSummary()
              .then((data) => setState({ status: 'success', data }))
              .catch((error: unknown) =>
                setState({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' })
              );
          }}
        >
          Retry
        </button>
      </section>
    );
  }

  const { data } = state;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <section aria-labelledby="kpi-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Core balances
          </h2>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.kpis.map((kpi) => (
            <div
              key={kpi.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{kpi.label}</dt>
              <dd className="mt-3 flex items-baseline justify-between">
                <Money value={kpi.value} className="text-2xl font-semibold" />
                <ChangePill value={kpi.change} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Cash runway</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tracking the last 30 days of net cash movement.
            </p>
          </div>
        </div>
        <TrendChart data={data.chart} />
      </section>
    </div>
  );
}

function ChangePill({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
        positive
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
          : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
      }`}
    >
      <span aria-hidden="true" className="mr-1">
        {positive ? '▲' : '▼'}
      </span>
      {Math.abs(value).toFixed(1)}%
      <span className="sr-only"> {positive ? 'increase' : 'decrease'} since last period</span>
    </span>
  );
}
