import React, { useEffect, useMemo, useState } from 'react';
import { BankLine, fetchBankLines, verifyBankLine } from '../lib/api';
import { DateDisplay } from '../ui/DateDisplay';
import { Money } from '../ui/Money';
import { Skeleton } from '../ui/Skeleton';
import { Drawer } from '../ui/Drawer';
import { StatusBadge } from '../ui/StatusBadge';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

type TableState = {
  status: LoadState;
  data?: {
    items: BankLine[];
    total: number;
  };
  error?: string;
};

const pageSize = 10;

export default function BankLinesRoute() {
  const [page, setPage] = useState(0);
  const [state, setState] = useState<TableState>({ status: 'idle' });
  const [selectedLine, setSelectedLine] = useState<BankLine | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionState, setActionState] = useState<'idle' | 'verifying' | 'error'>('idle');
  const [actionError, setActionError] = useState<string | undefined>();
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchBankLines({ page, pageSize, signal: controller.signal })
      .then((response) => {
        setState({
          status: 'success',
          data: { items: response.items, total: response.total }
        });
      })
      .catch((error: unknown) => {
        if ((error as DOMException)?.name === 'AbortError') return;
        setState({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      });
    return () => controller.abort();
  }, [page, reloadToken]);

  const reloadPage = () => setReloadToken((value) => value + 1);

  const totalPages = useMemo(() => {
    if (!state.data) return 0;
    return Math.ceil(state.data.total / pageSize);
  }, [state.data]);

  const openDrawer = (line: BankLine) => {
    setSelectedLine(line);
    setActionState('idle');
    setActionError(undefined);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedLine(null);
    setActionState('idle');
    setActionError(undefined);
  };

  const handleVerify = async () => {
    if (!selectedLine || selectedLine.status === 'verified') return;
    setActionState('verifying');
    setActionError(undefined);
    try {
      const updated = await verifyBankLine(selectedLine.id);
      setSelectedLine(updated);
      setState((previous) => {
        if (!previous.data) return previous;
        const updatedItems = previous.data.items.map((item) => (item.id === updated.id ? updated : item));
        return {
          status: 'success',
          data: {
            items: updatedItems,
            total: previous.data.total
          }
        };
      });
      setActionState('idle');
    } catch (error) {
      setActionState('error');
      setActionError(error instanceof Error ? error.message : 'Could not verify line');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Bank statement lines</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Monitor ingested bank lines and reconcile with the ledger.
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Page {page + 1}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
            <caption className="sr-only">Bank statement lines</caption>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-6 py-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 font-semibold">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 font-semibold">
                  Counterparty
                </th>
                <th scope="col" className="px-6 py-3 font-semibold text-right">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-6 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.status === 'loading' &&
                Array.from({ length: pageSize }).map((_, index) => (
                  <tr key={index} className="bg-white dark:bg-slate-900">
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="ml-auto h-4 w-20" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-14" /></td>
                  </tr>
                ))}

              {state.status === 'success' && state.data && state.data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                    No bank lines available for this period.
                  </td>
                </tr>
              ) : null}

              {state.status === 'success' && state.data
                ? state.data.items.map((line) => (
                    <tr key={line.id} className="bg-white transition hover:bg-indigo-50/50 dark:bg-slate-900 dark:hover:bg-slate-800">
                      <td className="whitespace-nowrap px-6 py-4">
                        <DateDisplay value={line.date} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{line.description}</div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{line.id}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{line.counterparty}</td>
                      <td className="px-6 py-4 text-right">
                        <Money value={line.amount} />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={line.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-500/50 dark:hover:text-indigo-200"
                          onClick={() => openDrawer(line)}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                : null}

              {state.status === 'error' ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-rose-600 dark:text-rose-300">
                    <div className="flex flex-col items-center gap-4">
                      <p>{state.error}</p>
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md bg-rose-600 px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                        onClick={reloadPage}
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-sm dark:border-slate-800">
          <div className="text-slate-500 dark:text-slate-400">
            Showing {state.data?.items.length ?? 0} of {state.data?.total ?? 0} lines
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:text-indigo-200"
              onClick={() => setPage((current) => Math.max(current - 1, 0))}
              disabled={page === 0 || state.status === 'loading'}
            >
              Previous
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Page {page + 1} of {totalPages || 1}
            </span>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:text-indigo-200"
              onClick={() => setPage((current) => (totalPages ? Math.min(current + 1, totalPages - 1) : current))}
              disabled={state.status === 'loading' || !totalPages || page >= totalPages - 1}
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      <Drawer
        title={selectedLine ? `RPT review for ${selectedLine.description}` : 'RPT review'}
        description="Review the RPT data before verifying the bank line."
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
        }}
        footer={
          <div className="flex items-center justify-between gap-4">
            {actionState === 'error' && actionError ? (
              <p className="text-sm text-rose-500" role="alert">
                {actionError}
              </p>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Verification locks the line for downstream reconciliation.
              </span>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-md border border-transparent px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-200"
                onClick={closeDrawer}
              >
                Close
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleVerify}
                disabled={!selectedLine || selectedLine.status === 'verified' || actionState === 'verifying'}
              >
                {selectedLine?.status === 'verified' ? 'Verified' : actionState === 'verifying' ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          </div>
        }
      >
        {selectedLine ? (
          <div className="space-y-6">
            <section aria-labelledby="line-summary-heading">
              <h3 id="line-summary-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Line summary
              </h3>
              <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Date</dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                    <DateDisplay value={selectedLine.date} withTime />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Amount</dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                    <Money value={selectedLine.amount} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Counterparty</dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-200">{selectedLine.counterparty}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Status</dt>
                  <dd className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                    <StatusBadge status={selectedLine.status} />
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="rpt-heading">
              <h3 id="rpt-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                RPT viewer
              </h3>
              <article className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                <p>
                  {selectedLine.rptExcerpt}
                </p>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  Ref: {selectedLine.id}
                </p>
              </article>
            </section>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Select a bank line to view RPT data.</p>
        )}
      </Drawer>
    </div>
  );
}
