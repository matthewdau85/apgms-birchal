import { useEffect, useMemo, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { api, handleApiError } from '../lib/api';
import { Money } from '../ui/Money';
import { DateText } from '../ui/DateText';
import { Skeleton } from '../ui/Skeleton';

type BankLine = {
  id: string;
  bankName: string;
  facilityName: string;
  totalLimit: number;
  utilized: number;
  currency: string;
  updatedAt: string;
  region?: string;
  status: 'active' | 'pending' | 'inactive';
  auditAvailable?: boolean;
  notes?: string;
};

type BankLinesResponse = {
  data: BankLine[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
};

type RequestState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: BankLine[];
  error?: string;
  total: number;
};

const PAGE_SIZE = 10;

export default function BankLinesRoute() {
  const [page, setPage] = useState(1);
  const [{ status, data, total, error }, setState] = useState<RequestState>({
    status: 'idle',
    data: [],
    total: 0
  });
  const [selectedLine, setSelectedLine] = useState<BankLine | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setState((prev) => ({ ...prev, status: 'loading' }));

    api
      .get<BankLinesResponse>('/banking/lines', {
        params: { page, pageSize: PAGE_SIZE }
      })
      .then((response) => {
        if (!isMounted) return;
        const payload = response.data;
        setState({
          status: 'success',
          data: payload?.data ?? [],
          total: payload?.meta?.total ?? (payload?.data?.length ?? 0),
          error: undefined
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        setState({
          status: 'error',
          data: [],
          total: 0,
          error: handleApiError(err)
        });
      });

    return () => {
      isMounted = false;
    };
  }, [page]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawerOpen(false);
        setSelectedLine(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const totalPages = useMemo(() => {
    return total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;
  }, [total]);

  const openDrawer = (line: BankLine) => {
    setSelectedLine(line);
    setVerifyStatus('idle');
    setVerifyError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedLine(null);
  };

  const handleVerify = async () => {
    if (!selectedLine) return;
    setVerifyStatus('loading');
    setVerifyError(null);
    try {
      await api.post(`/audit/rpt/by-line/${selectedLine.id}`);
      setVerifyStatus('success');
    } catch (err) {
      setVerifyError(handleApiError(err));
      setVerifyStatus('error');
    }
  };

  const isEmpty = status === 'success' && data.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Bank Lines</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Detailed view of all active facilities and their utilization.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Page {page} of {totalPages}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3">Bank</th>
                <th className="px-6 py-3">Facility</th>
                <th className="px-6 py-3 text-right">Limit</th>
                <th className="px-6 py-3 text-right">Utilized</th>
                <th className="px-6 py-3">Updated</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-sm dark:divide-slate-800 dark:bg-slate-900">
              {status === 'loading'
                ? Array.from({ length: PAGE_SIZE }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="text-sm">
                      <td className="px-6 py-4" colSpan={7}>
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                : null}

              {status !== 'loading' && !isEmpty
                ? data.map((line) => {
                    const utilizationPercent = line.totalLimit
                      ? Math.min(Math.round((line.utilized / line.totalLimit) * 100), 100)
                      : 0;
                    return (
                      <tr key={line.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                          <div>{line.bankName}</div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{line.region ?? '—'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-700 dark:text-slate-200">{line.facilityName}</div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{line.notes ?? 'No memo'}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Money value={line.totalLimit} currency={line.currency} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Money value={line.utilized} currency={line.currency} />
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <div className="h-1.5 w-20 rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                  className="h-full rounded-full bg-brand-500"
                                  style={{ width: `${utilizationPercent}%` }}
                                />
                              </div>
                              {utilizationPercent}%
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <DateText value={line.updatedAt} className="text-slate-600 dark:text-slate-300" />
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              line.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                : line.status === 'pending'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
                            }`}
                          >
                            {line.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openDrawer(line)}
                            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:text-brand-300 dark:hover:border-brand-500 dark:hover:bg-slate-800"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>

        {status === 'success' && isEmpty ? (
          <div className="border-t border-slate-200 p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            No bank lines found. Connect a facility to get started.
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="border-t border-rose-200 bg-rose-50 p-6 text-sm text-rose-600 dark:border-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={page === 1 || status === 'loading'}
        >
          <span aria-hidden="true">←</span>
          Previous
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={page >= totalPages || status === 'loading'}
        >
          Next
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {drawerOpen && selectedLine ? (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            aria-hidden="true"
            onClick={closeDrawer}
          />
          <FocusTrap
            active={drawerOpen}
            focusTrapOptions={{
              initialFocus: '#drawer-close-button',
              fallbackFocus: '#drawer-close-button',
              escapeDeactivates: false,
              clickOutsideDeactivates: false,
              onDeactivate: closeDrawer
            }}
          >
            <aside
              className="ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-2xl transition dark:bg-slate-900"
              role="dialog"
              aria-modal="true"
              aria-labelledby="drawer-title"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{selectedLine.bankName}</p>
                  <h3 id="drawer-title" className="text-xl font-semibold text-slate-900 dark:text-white">
                    {selectedLine.facilityName}
                  </h3>
                </div>
                <button
                  id="drawer-close-button"
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <span className="sr-only">Close details</span>
                  <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              <div className="mt-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/80">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Availability</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <Money
                      value={Math.max(selectedLine.totalLimit - selectedLine.utilized, 0)}
                      currency={selectedLine.currency}
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">Remaining</span>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/80">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Last update</p>
                  <DateText value={selectedLine.updatedAt} className="mt-1 block text-sm font-medium" />
                </div>
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/80">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
                  <p className="mt-1 text-sm font-semibold capitalize">{selectedLine.status}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</p>
                  <p className="mt-2 whitespace-pre-line text-sm">{selectedLine.notes ?? 'No additional context provided.'}</p>
                </div>
              </div>

              <div className="mt-auto pt-6">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={!selectedLine.auditAvailable || verifyStatus === 'loading'}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                >
                  {verifyStatus === 'loading' ? 'Verifying…' : 'Verify RPT'}
                </button>
                {verifyStatus === 'success' ? (
                  <p className="mt-3 text-sm text-emerald-500">RPT verification requested successfully.</p>
                ) : null}
                {verifyStatus === 'error' ? (
                  <p className="mt-3 text-sm text-rose-500">{verifyError}</p>
                ) : null}
                {!selectedLine.auditAvailable ? (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Audit verification will be enabled once this facility is eligible.
                  </p>
                ) : null}
              </div>
            </aside>
          </FocusTrap>
        </div>
      ) : null}
    </div>
  );
}
