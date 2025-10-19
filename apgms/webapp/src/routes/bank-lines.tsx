import { useMemo, useState } from 'react';
import { useBankLines, useRptByLine, type BankLine } from '../lib/hooks';
import { Money } from '../ui/Money';
import { DateTime } from '../ui/DateTime';
import { Skeleton } from '../ui/Skeleton';
import { Empty } from '../ui/Empty';
import { ErrorState } from '../ui/Error';
import { cn } from '../utils/cn';

export const BankLinesRoute = () => {
  const [query, setQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState<BankLine | null>(null);
  const [shouldVerify, setShouldVerify] = useState(false);
  const { data, isLoading, isError, refetch } = useBankLines(query);
  const { data: rptData, isFetching: isVerifying, isError: rptError, refetch: refetchRpt } = useRptByLine(
    selectedLine?.id,
    { enabled: Boolean(selectedLine?.id) && shouldVerify },
  );

  const lines = data?.data ?? data ?? [];

  const handleSelect = (line: BankLine) => {
    setSelectedLine(line);
    setShouldVerify(false);
  };

  const closeDrawer = () => {
    setSelectedLine(null);
    setShouldVerify(false);
  };

  const filteredLines = useMemo(() => {
    if (!query) return lines;
    const lower = query.toLowerCase();
    return lines.filter((line) =>
      [line.name, line.institution].some((field) => field?.toLowerCase().includes(lower)),
    );
  }, [lines, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search lines by institution"
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 md:w-72"
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {filteredLines.length} active {filteredLines.length === 1 ? 'line' : 'lines'}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()}>Unable to load bank lines.</ErrorState>
      ) : !filteredLines.length ? (
        <Empty>No bank lines match the current filters.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Limit</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reviewed</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredLines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{line.institution}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-300">{line.name}</td>
                  <td className="px-4 py-3"><Money amount={line.limit} currency={line.currency} /></td>
                  <td className="px-4 py-3"><Money amount={line.available} currency={line.currency} /></td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-1 text-xs font-medium',
                        line.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : line.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
                      )}
                    >
                      {line.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-300">
                    <DateTime value={line.lastReviewedAt} variant="date" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSelect(line)}
                      className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        className={cn(
          'fixed inset-y-0 right-0 z-40 w-full max-w-md transform bg-white shadow-xl transition-transform dark:bg-slate-950',
          selectedLine ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!selectedLine}
      >
        {selectedLine ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{selectedLine.institution}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedLine.name}</p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Limits</h3>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Facility limit</dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100">
                      <Money amount={selectedLine.limit} currency={selectedLine.currency} />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Available</dt>
                    <dd className="font-medium text-emerald-600 dark:text-emerald-300">
                      <Money amount={selectedLine.available} currency={selectedLine.currency} />
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Last review</h3>
                <p className="mt-2 text-slate-600 dark:text-slate-300">
                  <DateTime value={selectedLine.lastReviewedAt} />
                </p>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">RPT verification</h3>
                <p className="mt-1 text-xs text-slate-500">
                  We only surface verification status. Keys and internal identifiers remain hidden.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShouldVerify(true);
                    refetchRpt();
                  }}
                  className="mt-3 inline-flex items-center rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
                  disabled={isVerifying || !selectedLine?.id}
                >
                  {isVerifying ? 'Checking…' : 'Verify RPT'}
                </button>
                {shouldVerify ? (
                  <div className="mt-3 space-y-2">
                    {isVerifying ? <Skeleton className="h-4 w-32" /> : null}
                    {rptError ? (
                      <ErrorState className="text-xs" onRetry={() => refetchRpt()}>
                        Verification failed. Try again.
                      </ErrorState>
                    ) : null}
                    {rptData ? (
                      <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Status</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{rptData.status}</span>
                        </div>
                        {rptData.verifiedAt ? (
                          <div className="mt-1 text-xs text-slate-500">
                            Verified <DateTime value={rptData.verifiedAt} />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {!isVerifying && !rptError && !rptData ? (
                      <p className="text-xs text-slate-500">No verification recorded yet.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BankLinesRoute;
