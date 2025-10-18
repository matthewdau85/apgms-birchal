import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { DataState } from '@/components/DataState';
import { Drawer } from '@/components/Drawer';
import { FormattedDate } from '@/components/FormattedDate';
import { Money } from '@/components/Money';
import { Skeleton } from '@/components/Skeleton';
import { cn } from '@/lib/cn';
import { BankLine, fetchBankLines, verifyRptForLine } from '@/services/bankLines';

const PAGE_SIZE = 5;

const statusStyles: Record<BankLine['status'], string> = {
  Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  'Pending Review': 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  'On Hold': 'bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
};

const BankLinesRoute = () => {
  const [page, setPage] = useState(1);
  const [selectedLine, setSelectedLine] = useState<BankLine | null>(null);
  const [lastVerificationMessage, setLastVerificationMessage] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bank-lines'],
    queryFn: fetchBankLines,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: verifyRptForLine,
    onSuccess: (result) => {
      setLastVerificationMessage(`Verify RPT triggered for ${result.lineId}.`);
    },
    onError: () => {
      setLastVerificationMessage('We could not trigger the verification. Please try again.');
    },
  });

  const totalItems = data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  const pageItems = useMemo(() => {
    if (!data) return [];
    const start = (page - 1) * PAGE_SIZE;
    return data.slice(start, start + PAGE_SIZE);
  }, [data, page]);

  const handleOpenDrawer = (line: BankLine) => {
    setSelectedLine(line);
  };

  const handleCloseDrawer = () => {
    setSelectedLine(null);
  };

  const handleVerifyRpt = async (lineId: string) => {
    setLastVerificationMessage('');
    await mutation.mutateAsync(lineId);
  };

  const changePage = (direction: 'prev' | 'next') => {
    setPage((current) => {
      if (direction === 'prev') {
        return Math.max(1, current - 1);
      }
      return Math.min(totalPages, current + 1);
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Skeleton className="h-10 w-1/3" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: PAGE_SIZE }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <DataState
        tone="error"
        title="Unable to load bank lines"
        description="Please refresh to retry the request."
        action={
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            Retry
          </button>
        }
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <DataState
        title="No bank lines on file"
        description="As soon as treasury onboards facilities they will surface in this workspace."
        action={
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Refresh
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Bank lines</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor utilization, risk, and outstanding balances before remitting payments.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          {totalItems} facilities • Page {page} of {totalPages}
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600 dark:divide-slate-800 dark:text-slate-300">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Line
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Institution
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-right">
                  Limit
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-right">
                  Balance
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-right">
                  Updated
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-right">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {pageItems.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenDrawer(line)}
                      className="text-left font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      {line.lineName}
                    </button>
                  </td>
                  <td className="px-4 py-3">{line.institution}</td>
                  <td className="px-4 py-3 text-right">
                    <Money value={line.limit} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={line.balance} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FormattedDate value={line.updatedAt} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', statusStyles[line.status])}>
                      {line.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenDrawer(line)}
                      className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-slate-500 dark:text-slate-400">Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, totalItems)} of {totalItems}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changePage('prev')}
              disabled={page === 1}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => changePage('next')}
              disabled={page === totalPages}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </footer>
      </div>

      <div aria-live="polite" className="sr-only">
        {lastVerificationMessage}
      </div>

      <Drawer
        open={Boolean(selectedLine)}
        onClose={handleCloseDrawer}
        title={selectedLine?.lineName ?? ''}
        description={selectedLine ? `Facility ${selectedLine.id} with ${selectedLine.institution}` : undefined}
      >
        {selectedLine ? (
          <>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Limit</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  <Money value={selectedLine.limit} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Balance</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100">
                  <Money value={selectedLine.balance} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Status</dt>
                <dd>
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', statusStyles[selectedLine.status])}>
                    {selectedLine.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Risk Score</dt>
                <dd className="font-mono text-base font-semibold text-slate-900 dark:text-slate-100">
                  {selectedLine.riskScore}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Last updated</dt>
                <dd>
                  <FormattedDate value={selectedLine.updatedAt} />
                </dd>
              </div>
            </dl>
            <div className="mt-6 space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Trigger an audit verification to validate the remittance payment trace (RPT) before releasing funds downstream.
              </p>
              <button
                type="button"
                onClick={() => selectedLine && void handleVerifyRpt(selectedLine.id)}
                disabled={mutation.isPending}
                className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutation.isPending ? 'Verifying…' : 'Verify RPT'}
              </button>
            </div>
          </>
        ) : null}
      </Drawer>
    </div>
  );
};

export default BankLinesRoute;
