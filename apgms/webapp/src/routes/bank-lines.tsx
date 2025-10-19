import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchJSON } from '../api/client';
import { Drawer } from '../components/drawer';
import { clsx } from 'clsx';

const PAGE_SIZE = 10;

type BankLine = {
  id: string;
  date: string;
  payee: string;
  amount: number;
  currency?: string;
  rptId?: string | null;
};

type BankLinesResponse = {
  data?: BankLine[];
  meta?: {
    page?: number;
    pageSize?: number;
    totalPages?: number;
    totalItems?: number;
  };
};

type RptResponse = {
  id: string;
  status: string;
  lastVerifiedAt?: string;
  details?: string;
};

export function BankLines() {
  const [page, setPage] = useState(1);
  const [selectedLine, setSelectedLine] = useState<BankLine | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, isFetching } = useQuery<BankLinesResponse | null>({
    queryKey: ['bank-lines', page],
    queryFn: () => fetchJSON<BankLinesResponse>(`/bank-lines?page=${page}&pageSize=${PAGE_SIZE}`)
  });

  const lines = data?.data ?? [];
  const meta = data?.meta ?? {};
  const totalPages = meta.totalPages ?? (lines.length < PAGE_SIZE ? page : page + 1);

  const rptQueryKey = ['rpt', selectedLine?.id];
  const {
    data: rptData,
    isFetching: rptLoading,
    isError: rptError
  } = useQuery<RptResponse | null>({
    queryKey: rptQueryKey,
    queryFn: () => fetchJSON<RptResponse>(`/audit/rpt/by-line/${selectedLine?.id}`, { ignoreStatuses: [404] }),
    enabled: Boolean(selectedLine?.id),
    retry: false
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLine) {
        return null;
      }

      const response = await fetchJSON<RptResponse>(`/audit/rpt/by-line/${selectedLine.id}`, {
        method: 'POST',
        ignoreStatuses: [404]
      });

      return response;
    },
    onSuccess: (result) => {
      if (!selectedLine) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: rptQueryKey });
      setFeedback(result ? 'Verification completed.' : 'No RPT available for this bank line.');
    },
    onError: (mutationError) => {
      setFeedback(mutationError instanceof Error ? mutationError.message : 'Verification failed.');
    }
  });

  const openDrawer = (line: BankLine) => {
    setSelectedLine(line);
    setDrawerOpen(true);
    setFeedback(null);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedLine(null);
    setFeedback(null);
  };

  const formattedLines = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        formattedDate: new Date(line.date).toLocaleDateString(),
        formattedAmount: formatAmount(line.amount, line.currency)
      })),
    [lines]
  );

  return (
    <section aria-labelledby="bank-lines-heading" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 id="bank-lines-heading" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Bank Lines
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review recent bank line activity and verify related RPT records.
          </p>
        </div>
      </div>

      {isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error instanceof Error ? error.message : 'Unable to load bank lines.'}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                  Payee
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading || isFetching ? (
                Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <tr key={index} className="animate-pulse bg-slate-50/60 dark:bg-slate-800/60">
                    <td className="px-4 py-3">
                      <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="ml-auto h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                    </td>
                  </tr>
                ))
              ) : formattedLines.length > 0 ? (
                formattedLines.map((line) => (
                  <tr
                    key={line.id}
                    role="button"
                    aria-label={`View bank line for ${line.payee} dated ${line.formattedDate}`}
                    className="cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800/70"
                    onClick={() => openDrawer(line)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openDrawer(line);
                      }
                    }}
                  >
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{line.formattedDate}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{line.payee}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-900 dark:text-slate-100">
                      {line.formattedAmount}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No bank lines available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-500 dark:text-slate-400">
            Page {page}
            {typeof meta.totalPages === 'number' ? ` of ${Math.max(meta.totalPages, 1)}` : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className={clsx(
                'rounded-md border border-slate-200 px-3 py-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700',
                page <= 1
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                  : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              )}
              disabled={page <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={selectedLine ? `Bank line ${selectedLine.id}` : 'Bank line details'}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-300">
              {feedback
                ? feedback
                : rptError
                ? 'Unable to load RPT details.'
                : rptLoading
                ? 'Loading RPT status...'
                : rptData
                ? `Status: ${rptData.status}${
                    rptData.lastVerifiedAt ? ` · Last verified ${new Date(rptData.lastVerifiedAt).toLocaleString()}` : ''
                  }`
                : 'No RPT record is linked to this bank line.'}
            </div>
            <button
              type="button"
              onClick={() => verifyMutation.mutate()}
              disabled={!selectedLine || verifyMutation.isLoading || (!rptData && !rptError)}
              className="inline-flex items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifyMutation.isLoading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        }
      >
        {selectedLine ? (
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Date</dt>
              <dd className="text-sm text-slate-900 dark:text-slate-100">
                {new Date(selectedLine.date).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Payee</dt>
              <dd className="text-sm text-slate-900 dark:text-slate-100">{selectedLine.payee}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Amount</dt>
              <dd className="text-sm text-slate-900 dark:text-slate-100">
                {formatAmount(selectedLine.amount, selectedLine.currency)}
              </dd>
            </div>
            {selectedLine.rptId ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">RPT ID</dt>
                <dd className="text-sm text-slate-900 dark:text-slate-100">{selectedLine.rptId}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Select a bank line to view details.</p>
        )}
      </Drawer>
    </section>
  );
}

function formatAmount(amount: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol'
  }).format(amount);
}
