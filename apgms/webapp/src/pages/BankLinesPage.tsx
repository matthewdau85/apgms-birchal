import { useMutation, useQuery } from '@tanstack/react-query';
import FocusTrap from 'focus-trap-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { BankLine, fetchBankLines } from '../api/client';
import { DateText } from '../components/DateText';
import { Money } from '../components/Money';

const PAGE_SIZE = 8;

type DrawerState = {
  open: boolean;
  line?: BankLine;
};

export function BankLinesPage() {
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });

  const query = useQuery({
    queryKey: ['bank-lines', page, PAGE_SIZE],
    queryFn: ({ signal }) => fetchBankLines(page, PAGE_SIZE, signal),
    keepPreviousData: true
  });

  const totalPages = useMemo(() => {
    if (!query.data) return 1;
    return Math.max(1, Math.ceil(query.data.total / query.data.pageSize));
  }, [query.data]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openDrawer = (line: BankLine) => {
    setDrawer({ open: true, line });
  };

  const closeDrawer = () => {
    setDrawer({ open: false });
  };

  useEffect(() => {
    if (!drawer.open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawer.open]);

  const verifyMutation = useMutation({
    mutationFn: async (lineId: string) => {
      // Placeholder for future mutation
      await new Promise((resolve) => setTimeout(resolve, 200));
      return lineId;
    }
  });

  return (
    <section aria-labelledby="bank-lines-heading" className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="bank-lines-heading" className="text-2xl font-semibold tracking-tight">
            Bank Lines
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Monitor credit utilization and review outstanding repayment trajectories.
          </p>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing page {page} of {totalPages}
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800" aria-describedby="bank-lines-heading">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr>
                <HeaderCell>Line</HeaderCell>
                <HeaderCell>Utilization</HeaderCell>
                <HeaderCell>Limit</HeaderCell>
                <HeaderCell>Available</HeaderCell>
                <HeaderCell>Status</HeaderCell>
                <HeaderCell>Owner</HeaderCell>
                <HeaderCell>Updated</HeaderCell>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {query.isLoading ? (
                <LoadingRows />
              ) : query.isError ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-rose-600 dark:text-rose-300">
                    {(query.error as Error).message}
                  </td>
                </tr>
              ) : !query.data || query.data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-gray-600 dark:text-gray-400">
                    No bank lines available.
                  </td>
                </tr>
              ) : (
                query.data.items.map((line) => (
                  <Row key={line.id} line={line} onSelect={() => openDrawer(line)} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1 || query.isLoading}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 font-medium text-gray-700 shadow-sm transition hover:border-brand-500 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            Previous
          </button>
          <span>
            {query.isFetching && !query.isLoading ? 'Updating…' : `Total: ${query.data?.total ?? 0}`}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={page >= totalPages || query.isLoading}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 font-medium text-gray-700 shadow-sm transition hover:border-brand-500 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            Next
          </button>
        </footer>
      </div>

      <Drawer open={drawer.open} onClose={closeDrawer} line={drawer.line} onVerify={(lineId) => verifyMutation.mutate(lineId)} />
    </section>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
    >
      {children}
    </th>
  );
}

function LoadingRows() {
  return (
    <tr>
      <td colSpan={7} className="p-6">
        <div className="grid gap-2" role="status" aria-live="polite">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      </td>
    </tr>
  );
}

function Row({ line, onSelect }: { line: BankLine; onSelect: () => void }) {
  return (
    <tr
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${line.name}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className="cursor-pointer bg-white transition hover:bg-brand-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-gray-900 dark:hover:bg-gray-800"
    >
      <td className="px-4 py-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{line.name}</div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{line.id}</p>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900 dark:text-gray-100">{Math.round(line.utilization * 100)}%</span>
      </td>
      <td className="px-4 py-3">
        <Money value={line.limit} />
      </td>
      <td className="px-4 py-3">
        <Money value={line.available} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={line.status} />
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-700 dark:text-gray-200">{line.owner}</span>
      </td>
      <td className="px-4 py-3">
        <DateText value={line.updatedAt} variant="short" />
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: BankLine['status'] }) {
  const styles: Record<BankLine['status'], string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    hold: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function Drawer({ open, onClose, line, onVerify }: { open: boolean; onClose: () => void; line?: BankLine; onVerify: (lineId: string) => void }) {
  if (!open || !line) return null;
  return (
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <FocusTrap focusTrapOptions={{ initialFocus: '#drawer-heading' }}>
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-heading"
          className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-gray-200 bg-white p-6 shadow-2xl transition dark:border-gray-800 dark:bg-gray-900"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="drawer-heading" tabIndex={-1} className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {line.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Line ID {line.id}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="rounded-full border border-gray-200 p-2 text-gray-600 transition hover:border-brand-500 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <InfoRow label="Utilization">
              {Math.round(line.utilization * 100)}%
            </InfoRow>
            <InfoRow label="Limit">
              <Money value={line.limit} />
            </InfoRow>
            <InfoRow label="Available">
              <Money value={line.available} />
            </InfoRow>
            <InfoRow label="Owner">{line.owner}</InfoRow>
            <InfoRow label="Status">
              <StatusBadge status={line.status} />
            </InfoRow>
            <InfoRow label="Last update">
              <DateText value={line.updatedAt} />
            </InfoRow>
          </div>

          <div className="mt-auto space-y-3">
            <a
              href={`/audit/rpt/by-line/${line.id}`}
              className="flex w-full items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
            >
              Verify RPT
            </a>
            <button
              type="button"
              onClick={() => onVerify(line.id)}
              className="w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-500 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-100"
            >
              Mark as reviewed
            </button>
          </div>
        </aside>
      </FocusTrap>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100">{children}</span>
    </div>
  );
}
