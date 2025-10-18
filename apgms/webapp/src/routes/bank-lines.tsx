import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';

import { api } from '../lib/api';
import { DateText } from '../ui/DateText';
import { Money } from '../ui/Money';
import { Skeleton } from '../ui/Skeleton';
import { Route as RootRoute } from './__root';

const TAKE = 20;
const DEFAULT_ORG = 'core';

type BankLine = {
  id: string;
  date: string;
  description: string;
  counterparty: string;
  amount: number;
  status: 'pending' | 'verified' | 'flagged';
  category?: string;
  rptAvailable?: boolean;
};

type BankLinesResponse = {
  data: BankLine[];
  nextCursor?: string | null;
  prevCursor?: string | null;
};

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: 'bank-lines',
  component: BankLinesPage,
});

function BankLinesPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, isError, error } = useQuery<BankLinesResponse>({
    queryKey: ['bank-lines', { orgId: DEFAULT_ORG, cursor, take: TAKE }],
    queryFn: async () => {
      const response = await api.get<BankLinesResponse>('/bank-lines', {
        params: {
          orgId: DEFAULT_ORG,
          cursor: cursor ?? undefined,
          take: TAKE,
        },
      });
      return response.data;
    },
    keepPreviousData: true,
  });

  useEffect(() => {
    if (!data?.nextCursor) return;
    queryClient.prefetchQuery({
      queryKey: ['bank-lines', { orgId: DEFAULT_ORG, cursor: data.nextCursor, take: TAKE }],
      queryFn: async () => {
        const response = await api.get<BankLinesResponse>('/bank-lines', {
          params: { orgId: DEFAULT_ORG, cursor: data.nextCursor ?? undefined, take: TAKE },
        });
        return response.data;
      },
    });
  }, [data?.nextCursor, queryClient]);

  const [selected, setSelected] = useState<BankLine | null>(null);

  useEffect(() => {
    if (selected && data?.data) {
      const exists = data.data.find((line) => line.id === selected.id);
      if (!exists) {
        setSelected(null);
      }
    }
  }, [data?.data, selected]);

  const rows = data?.data ?? [];

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Bank lines</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review incoming and outgoing transactions synced from your bank feeds.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className={clsx('flex items-center gap-2 rounded-full px-3 py-1', isFetching && 'bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200')}>
            <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden />
            {isFetching ? 'Syncing latest entries…' : 'Up to date'}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <BankLinesSkeleton />
        ) : isError ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-rose-500">
            {(error as Error)?.message ?? 'Unable to load bank lines.'}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-10 text-sm text-slate-500 dark:text-slate-400">
            No lines found for this organisation.
          </div>
        ) : (
          <div className="flex h-full">
            <div className="w-full overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Counterparty</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  {rows.map((line) => (
                    <tr
                      key={line.id}
                      className="cursor-pointer bg-white transition hover:bg-brand-50/40 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                      onClick={() => setSelected(line)}
                    >
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        <DateText value={line.date} />
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{line.description}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{line.counterparty}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                        <Money value={line.amount} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={line.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => data?.prevCursor && setCursor(data.prevCursor)}
                  disabled={!data?.prevCursor}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  ← Previous
                </button>
                <span>
                  Showing <strong>{rows.length}</strong> of <strong>{TAKE}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => data?.nextCursor && setCursor(data.nextCursor)}
                  disabled={!data?.nextCursor}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Next →
                </button>
              </div>
            </div>
            {selected && <BankLineDrawer key={selected.id} line={selected} onClose={() => setSelected(null)} />}
          </div>
        )}
      </div>
    </div>
  );
}

function BankLinesSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex-1 space-y-3 p-4">
        {[...Array(6)].map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

type StatusPillProps = {
  status: BankLine['status'];
};

function StatusPill({ status }: StatusPillProps) {
  const classes = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
    verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
    flagged: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
  }[status];

  return <span className={clsx('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize', classes)}>{status}</span>;
}

type BankLineDrawerProps = {
  line: BankLine;
  onClose: () => void;
};

function BankLineDrawer({ line, onClose }: BankLineDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const firstFocusable = useRef<HTMLButtonElement | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!line.rptAvailable) return;
      await api.post(`/audit/rpt/by-line/${line.id}`);
    },
  });

  useEffect(() => {
    firstFocusable.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }

      if (event.key !== 'Tab') return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          (last as HTMLElement).focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        (first as HTMLElement).focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fields = useMemo(
    () => [
      { label: 'Date', value: <DateText value={line.date} pattern="dd MMM yyyy, h:mma" /> },
      { label: 'Amount', value: <Money value={line.amount} /> },
      { label: 'Status', value: <StatusPill status={line.status} /> },
      { label: 'Counterparty', value: line.counterparty },
      { label: 'Category', value: line.category ?? 'Unassigned' },
    ],
    [line],
  );

  return (
    <aside
      ref={drawerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Line details"
      className="flex w-96 flex-col border-l border-slate-200 bg-white/95 p-6 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Line details</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Match, annotate, or escalate this record.</p>
        </div>
        <button
          ref={firstFocusable}
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>

      <dl className="mt-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{field.label}</dt>
            <dd className="mt-1 text-base text-slate-900 dark:text-slate-100">{field.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!line.rptAvailable || mutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        >
          Verify RPT
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    </aside>
  );
}
