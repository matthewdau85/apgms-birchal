import { createRoute, useNavigate } from '@tanstack/react-router';
import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  fetchBankLines,
  verifyRpt,
  type BankLine,
  type BankLinesResponse
} from '../lib/api';
import { AppRouterContext } from '../router';
import { DateText } from '../ui/Date';
import { Money } from '../ui/Money';
import { Route as rootRoute } from './__root';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

const bankLinesQueryOptions = (page: number, perPage: number) =>
  queryOptions<BankLinesResponse>({
    queryKey: ['bank-lines', { page, perPage }],
    queryFn: () => fetchBankLines({ page, perPage }),
    staleTime: 60 * 1000
  });

const parsePositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const allowedPageSizes = [10, 25, 50];

const normaliseSearch = (search: Record<string, unknown>): { page: number; perPage: number } => {
  const page = parsePositiveInteger(search.page, DEFAULT_PAGE);
  const perPageCandidate = parsePositiveInteger(search.perPage, DEFAULT_PAGE_SIZE);
  const perPage = allowedPageSizes.includes(perPageCandidate) ? perPageCandidate : DEFAULT_PAGE_SIZE;
  return { page, perPage };
};

const BankLinesPage = () => {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.id });
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<BankLine | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const query = useQuery({
    ...bankLinesQueryOptions(search.page, search.perPage),
    placeholderData: keepPreviousData
  });

  const verifyMutation = useMutation({
    mutationFn: (facilityId: string) => verifyRpt(facilityId),
    onMutate: (facilityId) => {
      setStatusMessage(`Starting RPT verification for facility ${facilityId}.`);
    },
    onSuccess: async (_, facilityId) => {
      await queryClient.invalidateQueries({ queryKey: ['bank-lines'] });
      setStatusMessage(`RPT verification started for facility ${facilityId}.`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to start verification right now.';
      setStatusMessage(message);
    }
  });

  const data = query.data;

  const totalPages = useMemo(() => {
    if (!data) {
      return 1;
    }
    return Math.max(1, Math.ceil(data.pagination.total / data.pagination.perPage));
  }, [data]);

  const goToPage = (page: number) => {
    navigate({
      search: (current) => ({
        ...current,
        page
      })
    });
  };

  const changePageSize = (perPage: number) => {
    navigate({
      search: (current) => ({
        ...current,
        page: DEFAULT_PAGE,
        perPage
      })
    });
  };

  useEffect(() => {
    if (!selected) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  if (!data) {
    return null;
  }

  if (!data.data.length) {
    return <BankLinesEmpty />;
  }

  const { pagination, totals } = data;
  const firstItem = (pagination.page - 1) * pagination.perPage + 1;
  const lastItem = Math.min(pagination.page * pagination.perPage, pagination.total);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Bank lines</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Facility utilisation, maturities and rapid verification entry points.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Showing {firstItem}-{lastItem} of {pagination.total} facilities
        </div>
      </header>

      <section aria-labelledby="summary-heading" className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <h2 id="summary-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
          Totals
        </h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-3">
          <SummaryItem label="Aggregate limit">
            <Money value={totals.aggregateLimit} />
          </SummaryItem>
          <SummaryItem label="Aggregate drawn">
            <Money value={totals.aggregateDrawn} />
          </SummaryItem>
          <SummaryItem label="Average utilisation">
            <span className="tabular-nums text-lg font-semibold text-slate-900 dark:text-white">
              {totals.averageUtilisation.toFixed(1)}%
            </span>
          </SummaryItem>
        </dl>
      </section>

      <section aria-labelledby="table-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="table-heading" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Facilities
          </h2>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Rows per page</span>
            <div className="relative">
              <select
                className="appearance-none rounded-md border border-slate-200 bg-white px-3 py-1.5 pr-8 text-sm font-medium text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={pagination.perPage}
                onChange={(event) => changePageSize(Number(event.target.value))}
                aria-label="Rows per page"
              >
                {allowedPageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400" aria-hidden>
                ▾
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600 dark:divide-slate-800 dark:text-slate-300">
            <caption className="sr-only">Bank line facilities and utilisation</caption>
            <thead className="bg-slate-50/70 dark:bg-slate-800">
              <tr>
                <SortableHeading label="Facility" />
                <SortableHeading label="Bank" />
                <SortableHeading label="Limit" numeric />
                <SortableHeading label="Drawn" numeric />
                <SortableHeading label="Utilisation" numeric />
                <SortableHeading label="Maturity" />
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800" aria-busy={query.isFetching}>
              {data.data.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/70">
                  <th scope="row" className="px-3 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                    {line.facility}
                  </th>
                  <td className="px-3 py-3 text-sm">{line.bank}</td>
                  <td className="px-3 py-3 text-sm">
                    <Money value={line.limit} />
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <Money value={line.drawn} />
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <span className="tabular-nums">{line.utilisation.toFixed(1)}%</span>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <DateText value={line.maturityDate} />
                  </td>
                  <td className="px-3 py-3 text-right text-sm">
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-200"
                      onClick={() => {
                        setSelected(line);
                        setStatusMessage('');
                      }}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, pagination.page - 1))}
                disabled={pagination.page <= 1}
                className="rounded-md border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-200"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => goToPage(Math.min(totalPages, pagination.page + 1))}
                disabled={pagination.page >= totalPages}
                className="rounded-md border border-slate-200 px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-200"
              >
                Next
              </button>
            </div>
            <div>
              Page {pagination.page} of {totalPages}
            </div>
          </footer>
        </div>
      </section>

      <div aria-live="polite" className="sr-only">
        {query.isFetching ? 'Loading facilities' : statusMessage}
      </div>

      {selected && (
        <Drawer onClose={() => setSelected(null)} titleId={`facility-${selected.id}-title`}>
          <DrawerHeader title={selected.facility} titleId={`facility-${selected.id}-title`} onClose={() => setSelected(null)} />
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Facility details</h3>
              <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                <DetailItem label="Bank">{selected.bank}</DetailItem>
                <DetailItem label="Limit">
                  <Money value={selected.limit} />
                </DetailItem>
                <DetailItem label="Drawn">
                  <Money value={selected.drawn} />
                </DetailItem>
                <DetailItem label="Utilisation">
                  <span className="tabular-nums font-semibold">{selected.utilisation.toFixed(1)}%</span>
                </DetailItem>
                <DetailItem label="Maturity">
                  <DateText value={selected.maturityDate} />
                </DetailItem>
                <DetailItem label="Cost of funds">
                  <span className="tabular-nums font-semibold">{selected.costOfFundsBps.toFixed(0)} bps</span>
                </DetailItem>
                <DetailItem label="Status">
                  <StatusPill status={selected.status} />
                </DetailItem>
              </dl>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Rapid tests</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Trigger a real-time RPT verification for this facility. We will record the request and update the audit trail automatically.
              </p>
              <button
                type="button"
                onClick={() => verifyMutation.mutate(selected.id)}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? 'Verifying…' : 'RPT Verify'}
              </button>
              {verifyMutation.isError && (
                <p role="alert" className="text-sm text-rose-500">
                  {verifyMutation.error instanceof Error
                    ? verifyMutation.error.message
                    : 'Unable to start verification right now.'}
                </p>
              )}
            </section>
          </div>
        </Drawer>
      )}
    </div>
  );
};

const SummaryItem = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-1">
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="text-lg font-semibold text-slate-900 dark:text-white">{children}</dd>
  </div>
);

const DetailItem = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-1">
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="text-sm text-slate-700 dark:text-slate-200">{children}</dd>
  </div>
);

const SortableHeading = ({ label, numeric }: { label: string; numeric?: boolean }) => (
  <th
    scope="col"
    className={clsx('px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500', numeric ? 'text-right' : 'text-left')}
  >
    {label}
  </th>
);

const StatusPill = ({ status }: { status: BankLine['status'] }) => {
  const copy = {
    active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-200' },
    review: { label: 'Under review', className: 'bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-200' }
  }[status];

  if (!copy) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
        Unknown
      </span>
    );
  }

  return <span className={clsx('inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold', copy.className)}>{copy.label}</span>;
};

const Drawer = ({ children, onClose, titleId }: { children: ReactNode; onClose: () => void; titleId: string }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/40 backdrop-blur-sm">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl transition dark:border-slate-800 dark:bg-slate-900"
    >
      {children}
      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-200"
      >
        Close
      </button>
    </div>
    <button
      type="button"
      className="absolute inset-0 h-full w-full cursor-pointer"
      aria-hidden="true"
      tabIndex={-1}
      onClick={onClose}
    />
  </div>
);

const DrawerHeader = ({ title, onClose, titleId }: { title: string; onClose: () => void; titleId: string }) => (
  <header className="flex items-start justify-between gap-4">
    <div>
      <h2 id={titleId} className="text-xl font-semibold text-slate-900 dark:text-white">
        {title}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Facility insights and verification controls.</p>
    </div>
    <button
      type="button"
      onClick={onClose}
      className="rounded-full border border-slate-200 p-1 text-slate-500 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:text-slate-200"
      aria-label="Close drawer"
    >
      ×
    </button>
  </header>
);

const BankLinesEmpty = () => (
  <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center dark:border-slate-700 dark:bg-slate-900/60">
    <div className="text-4xl" aria-hidden>
      🏦
    </div>
    <div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">No bank lines configured</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        Add a facility to see utilisation, maturities and audit controls in one place.
      </p>
    </div>
  </div>
);

const BankLinesSkeleton = () => (
  <div className="space-y-6">
    <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
    <div className="h-28 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-700/70" />
    <div className="h-96 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-700/70" />
  </div>
);

const BankLinesError = ({ error }: { error: unknown }) => (
  <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
    <h2 className="text-lg font-semibold">Unable to load bank lines</h2>
    <p className="mt-2 text-sm">
      {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again shortly.'}
    </p>
  </div>
);

export const Route = createRoute<AppRouterContext>({
  getParentRoute: () => rootRoute,
  path: '/bank-lines',
  validateSearch: normaliseSearch,
  loader: async ({ context, search }) => {
    await context.queryClient.ensureQueryData(bankLinesQueryOptions(search.page, search.perPage));
    return {};
  },
  component: BankLinesPage,
  pendingComponent: BankLinesSkeleton,
  errorComponent: BankLinesError
});

export { bankLinesQueryOptions };
