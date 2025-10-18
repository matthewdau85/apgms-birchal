import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';

import { BankLine, fetchBankLines, verifyBankLineRpt } from '../lib/api';
import Money from '../ui/Money';
import DateText from '../ui/DateText';
import Skeleton from '../ui/Skeleton';

const PAGE_SIZE = 10;

type VerificationState = 'idle' | 'loading' | 'success' | 'error';

function BankLinesRoute(): JSX.Element {
  const [page, setPage] = useState(1);
  const [selectedLine, setSelectedLine] = useState<BankLine | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['bank-lines', page],
    queryFn: () => fetchBankLines({ page, perPage: PAGE_SIZE }),
    keepPreviousData: true,
    staleTime: 15_000
  });

  const lines = data?.data ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  const openLine = useCallback((line: BankLine) => {
    setSelectedLine(line);
    setVerificationState('idle');
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setVerificationState('idle');
    setSelectedLine(null);
  }, []);

  const handleVerify = useCallback(async () => {
    if (!selectedLine) {
      return;
    }

    try {
      setVerificationState('loading');
      await verifyBankLineRpt(selectedLine.id);
      setVerificationState('success');
    } catch (verificationError) {
      console.warn('Failed to verify RPT', verificationError);
      setVerificationState('error');
    }
  }, [selectedLine]);

  const availability = useMemo(() => {
    if (!selectedLine) {
      return 0;
    }
    return selectedLine.limit - selectedLine.outstanding;
  }, [selectedLine]);

  const canGoBack = page > 1 && !isFetching;
  const canGoForward = page < totalPages && !isFetching;

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Bank lines</h1>
        <p className="text-sm text-muted-foreground">
          Review available facilities and submit verification reports.
        </p>
      </section>

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {error instanceof Error ? error.message : 'We were unable to load bank lines.'}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3">Institution</th>
                <th scope="col" className="px-4 py-3">Limit</th>
                <th scope="col" className="px-4 py-3">Outstanding</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: PAGE_SIZE }).map((_, index) => (
                    <tr key={index}>
                      <td className="px-4 py-4" colSpan={5}>
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                : lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No bank lines found.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line) => (
                      <tr
                        key={line.id}
                        className="cursor-pointer bg-card transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        role="button"
                        tabIndex={0}
                        aria-label={`View ${line.institution} facility details`}
                        onClick={() => openLine(line)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openLine(line);
                          }
                        }}
                      >
                        <td className="px-4 py-4">
                          <div className="font-medium text-card-foreground">{line.institution}</div>
                          <div className="text-sm text-muted-foreground">{line.facilityType}</div>
                        </td>
                        <td className="px-4 py-4">
                          <Money value={line.limit} currency={line.currency} />
                        </td>
                        <td className="px-4 py-4">
                          <Money value={line.outstanding} currency={line.currency} />
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                            {line.status ?? 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <DateText value={line.updatedAt} />
                        </td>
                      </tr>
                    ))
                  )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            Showing page {page} of {totalPages}
            {totalItems ? ` · ${totalItems} total` : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={!canGoBack}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground shadow-sm transition-colors enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={!canGoForward}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground shadow-sm transition-colors enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <Dialog.Root
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-border bg-card p-6 shadow-xl transition-transform duration-200 data-[state=closed]:translate-x-full data-[state=open]:translate-x-0">
            <Dialog.Title className="text-lg font-semibold text-card-foreground">
              {selectedLine?.institution ?? 'Facility'}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {selectedLine?.facilityType ?? 'Facility details'}
            </Dialog.Description>

            {selectedLine && (
              <div className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Limit</p>
                    <p className="text-lg font-semibold text-card-foreground">
                      <Money value={selectedLine.limit} currency={selectedLine.currency} />
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                    <p className="text-lg font-semibold text-card-foreground">
                      <Money value={selectedLine.outstanding} currency={selectedLine.currency} />
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Available</p>
                    <p className="text-lg font-semibold text-card-foreground">
                      <Money value={availability} currency={selectedLine.currency} />
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-lg font-semibold text-card-foreground">{selectedLine.status ?? 'Pending'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last updated</p>
                  <DateText value={selectedLine.updatedAt} className="mt-1" options={{ dateStyle: 'medium', timeStyle: 'short' }} />
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleVerify}
                disabled={verificationState === 'loading'}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verificationState === 'loading' ? 'Verifying…' : 'Verify RPT'}
              </button>
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {verificationState === 'success' && 'RPT verification request submitted successfully.'}
                {verificationState === 'error' && 'There was a problem verifying this report. Please try again.'}
                {verificationState === 'loading' && 'Hold tight while we process your verification.'}
              </p>
              <Dialog.Close className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-sm transition-colors hover:bg-muted">
                Close
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default BankLinesRoute;
