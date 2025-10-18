import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DateText } from '../components/DateText';
import { Money } from '../components/Money';
import { ApiError, PaginatedResponse, apiFetch } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

const TAKE_OPTIONS = [10, 25, 50] as const;

type BankLine = {
  id: string;
  name: string;
  status: string;
  balance: number;
  updatedAt: string;
  institution?: string | null;
  accountNumber?: string | null;
  limit?: number | null;
};

type BankLineDetail = BankLine & {
  owner?: string | null;
  createdAt?: string;
  metadata?: Record<string, string | number | null>;
};

function queryKey(take: number, cursor?: string | null) {
  return ['bank-lines', take, cursor ?? null] as const;
}

async function fetchBankLines(take: number, cursor?: string | null) {
  const params = new URLSearchParams({ take: String(take) });
  if (cursor) {
    params.append('cursor', cursor);
  }
  return apiFetch<PaginatedResponse<BankLine>>(`/bank-lines?${params.toString()}`);
}

async function fetchBankLine(id: string) {
  return apiFetch<BankLineDetail>(`/bank-lines/${id}`);
}

function getFocusableElements(container: HTMLElement) {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ];
  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(','))).filter(
    (element) => !element.hasAttribute('inert') && !element.getAttribute('aria-hidden')
  );
}

function FocusTrap({ children, onEscape }: { children: ReactNode; onEscape: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = getFocusableElements(container);
    (focusables[0] ?? container).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
        return;
      }

      if (event.key === 'Tab' && focusables.length) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onEscape]);

  return (
    <div ref={containerRef} tabIndex={-1}>
      {children}
    </div>
  );
}

export default function BankLinesRoute() {
  const [take, setTake] = useState<(typeof TAKE_OPTIONS)[number]>(TAKE_OPTIONS[0]);
  const [cursor, setCursor] = useState<string | null>();
  const [previousCursors, setPreviousCursors] = useState<string[]>([]);
  const [selectedLine, setSelectedLine] = useState<BankLine | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKey(take, cursor),
    queryFn: () => fetchBankLines(take, cursor ?? undefined),
    keepPreviousData: true
  });

  const items = data?.items ?? [];
  const nextCursor = data?.nextCursor ?? null;

  const handleChangeTake = (value: (typeof TAKE_OPTIONS)[number]) => {
    setTake(value);
    setCursor(undefined);
    setPreviousCursors([]);
  };

  const goToNext = () => {
    if (!nextCursor) return;
    setPreviousCursors((prev) => [...prev, cursor ?? '']);
    setCursor(nextCursor);
  };

  const goToPrevious = () => {
    setPreviousCursors((prev) => {
      if (prev.length === 0) return prev;
      const newPrev = [...prev];
      const next = newPrev.pop();
      setCursor(next && next.length ? next : undefined);
      return newPrev;
    });
  };

  const openDrawer = (line: BankLine) => {
    setSelectedLine(line);
  };

  const closeDrawer = useCallback(() => {
    setSelectedLine(null);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bank lines</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Monitor each bank line&apos;s latest balance and status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" htmlFor="take-select">
            Rows per page
          </label>
          <select
            id="take-select"
            value={take}
            onChange={(event) => handleChangeTake(Number(event.target.value) as (typeof TAKE_OPTIONS)[number])}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:border-slate-700 dark:bg-slate-900"
          >
            {TAKE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {isLoading && (
        <Card>
          <CardContent>
            <p className="animate-pulse text-sm text-slate-600 dark:text-slate-400">Loading bank lines…</p>
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card intent="danger">
          <CardHeader>
            <CardTitle>Unable to load bank lines</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No bank lines found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Once bank lines are added, you&apos;ll see them listed here with their current balances and activity.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <caption className="sr-only">Bank lines overview</caption>
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Institution
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Balance
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Updated
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {items.map((line) => (
                  <tr key={line.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <th scope="row" className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {line.name}
                    </th>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {line.institution ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <Money value={line.balance} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <DateText value={line.updatedAt} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold ${
                          line.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                            : line.status === 'review'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
                        {line.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
                        onClick={() => openDrawer(line)}
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <div>
              Showing {items.length} of {data?.total ?? 'many'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToPrevious}
                disabled={previousCursors.length === 0}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={goToNext}
                disabled={!nextCursor}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      <BankLineDrawer line={selectedLine} onClose={closeDrawer} />
    </div>
  );
}

function BankLineDrawer({ line, onClose }: { line: BankLine | null; onClose: () => void }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bank-line', line?.id],
    queryFn: () => fetchBankLine(line!.id),
    enabled: Boolean(line?.id)
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!line) {
      setVerificationMessage(null);
      setIsVerifying(false);
    }
  }, [line]);

  const handleVerify = useCallback(async () => {
    if (!line) return;
    setIsVerifying(true);
    setVerificationMessage(null);

    try {
      const result = await apiFetch<{ message?: string }>(`/audit/rpt/by-line/${line.id}`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      setVerificationMessage(result?.message ?? 'Verification request sent.');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 404 || apiError.status === 501) {
        setVerificationMessage('Audit service is not available yet. We will enable RPT verification soon.');
      } else {
        setVerificationMessage(apiError.message ?? 'Unable to verify RPT.');
      }
    } finally {
      setIsVerifying(false);
    }
  }, [line]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!line) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bank-line-title"
      className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/40 backdrop-blur-sm"
      onClick={handleClose}
    >
      <FocusTrap onEscape={handleClose}>
        <div
          className="h-full w-full max-w-md border-l border-slate-200 bg-white shadow-xl transition dark:border-slate-800 dark:bg-slate-900"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h2 id="bank-line-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {line.name}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
            >
              <span aria-hidden>✕</span>
              <span className="sr-only">Close</span>
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6 text-sm text-slate-700 dark:text-slate-300">
            {isLoading && <p className="animate-pulse">Loading details…</p>}
            {isError && <p>{error instanceof Error ? error.message : 'Unable to load details'}</p>}
            {!isLoading && !isError && (
              <div className="space-y-4">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</h3>
                  <dl className="mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Institution</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">{line.institution ?? '—'}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Account</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">{line.accountNumber ?? '—'}</dd>
                    </div>
                    {data?.owner && (
                      <div className="flex items-center justify-between">
                        <dt className="text-slate-500">Owner</dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">{data.owner}</dd>
                      </div>
                    )}
                    {data?.createdAt && (
                      <div className="flex items-center justify-between">
                        <dt className="text-slate-500">Created</dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">
                          <DateText value={data.createdAt} />
                        </dd>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Available limit</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">
                        {typeof line.limit === 'number' ? <Money value={line.limit} /> : '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Balance</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">
                        <Money value={line.balance} />
                      </dd>
                    </div>
                  </dl>
                </section>
                {data?.metadata && Object.keys(data.metadata).length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metadata</h3>
                    <dl className="mt-2 space-y-2">
                      {Object.entries(data.metadata).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <dt className="text-slate-500">{key}</dt>
                          <dd className="font-medium text-slate-900 dark:text-slate-100">{String(value ?? '—')}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Verify RPT</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Validate that the most recent RPT documents are on file for this bank line.
              </p>
              <button
                type="button"
                onClick={handleVerify}
                disabled={isVerifying}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-primary-500 bg-primary-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-primary-400 dark:bg-primary-500 dark:hover:bg-primary-400 dark:focus-visible:ring-offset-slate-900"
              >
                {isVerifying ? 'Verifying…' : 'Verify RPT'}
              </button>
              {verificationMessage && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{verificationMessage}</p>}
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
