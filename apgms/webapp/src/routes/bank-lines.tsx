import { useEffect, useMemo, useRef, useState } from 'react';
import { Table, getFocusableElements } from '../ui/Table';

type BankLine = {
  id: string;
  postedAt: string;
  payee: string;
  amount: number;
  reference: string;
  category?: string;
  rptId?: string | null;
};

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
});

const BANK_LINES: BankLine[] = [
  { id: '1', postedAt: '2024-09-02', payee: 'Acme Supplies', amount: -824.5, reference: 'INV-1402', category: 'Supplies', rptId: 'rpt-1' },
  { id: '2', postedAt: '2024-09-02', payee: 'Brightside Media', amount: -1250, reference: 'AD-447', category: 'Marketing' },
  { id: '3', postedAt: '2024-09-01', payee: 'City of Melbourne', amount: -460.8, reference: 'RATE-2024', category: 'Rates', rptId: 'rpt-3' },
  { id: '4', postedAt: '2024-08-31', payee: 'Talent Partners', amount: -5600, reference: 'PAY-883', category: 'Payroll', rptId: 'rpt-4' },
  { id: '5', postedAt: '2024-08-30', payee: 'OfficeHub', amount: -1450, reference: 'LEASE-42', category: 'Rent' },
  { id: '6', postedAt: '2024-08-30', payee: 'ATO', amount: -3200, reference: 'PAYGW', category: 'Tax', rptId: 'rpt-6' },
  { id: '7', postedAt: '2024-08-29', payee: 'Amazon Web Services', amount: -920.23, reference: 'AWS-2024-08', category: 'Hosting' },
  { id: '8', postedAt: '2024-08-29', payee: 'Optus Business', amount: -280.76, reference: 'OPT-2239', category: 'Telecoms', rptId: 'rpt-8' },
  { id: '9', postedAt: '2024-08-28', payee: 'Stripe', amount: 9650.22, reference: 'PAYOUT-0928', category: 'Revenue' },
  { id: '10', postedAt: '2024-08-27', payee: 'ATO', amount: -2400, reference: 'GST', category: 'Tax' },
  { id: '11', postedAt: '2024-08-26', payee: 'Metro Utilities', amount: -380.4, reference: 'UTIL-549', category: 'Utilities', rptId: 'rpt-11' },
  { id: '12', postedAt: '2024-08-25', payee: 'Stationery Co', amount: -210.3, reference: 'ST-02', category: 'Office' },
  { id: '13', postedAt: '2024-08-24', payee: 'HubSpot', amount: -480, reference: 'CRM-2024', category: 'Subscriptions', rptId: 'rpt-13' },
  { id: '14', postedAt: '2024-08-23', payee: 'Zoom', amount: -180, reference: 'MEET-88', category: 'Subscriptions' },
  { id: '15', postedAt: '2024-08-22', payee: 'Fresh Catering', amount: -320.55, reference: 'CAT-55', category: 'Events', rptId: 'rpt-15' },
  { id: '16', postedAt: '2024-08-21', payee: 'Stripe', amount: 12450.65, reference: 'PAYOUT-0821', category: 'Revenue', rptId: 'rpt-16' },
  { id: '17', postedAt: '2024-08-20', payee: 'ATO', amount: -1450, reference: 'PAYGW', category: 'Tax' },
  { id: '18', postedAt: '2024-08-19', payee: 'Jet Courier', amount: -95.6, reference: 'LOG-19', category: 'Logistics' },
  { id: '19', postedAt: '2024-08-18', payee: 'Canva', amount: -34.99, reference: 'SUB-991', category: 'Subscriptions' },
  { id: '20', postedAt: '2024-08-17', payee: 'Google Ads', amount: -1520, reference: 'AD-332', category: 'Marketing', rptId: 'rpt-20' },
];

const PAGE_SIZE = 8;

function formatCurrency(value: number) {
  return CURRENCY_FORMATTER.format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BankLinesRoute() {
  const [page, setPage] = useState(0);
  const [selectedLine, setSelectedLine] = useState<BankLine | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  const totalPages = Math.ceil(BANK_LINES.length / PAGE_SIZE);

  const pageData = useMemo(() => {
    const start = page * PAGE_SIZE;
    return BANK_LINES.slice(start, start + PAGE_SIZE);
  }, [page]);

  useEffect(() => {
    if (!selectedLine) {
      const last = lastFocusedElement.current;
      if (last) {
        last.focus();
      }
      return;
    }

    const drawerEl = drawerRef.current;
    const focusable = getFocusableElements(drawerEl);
    focusable[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      const focusTargets = getFocusableElements(drawerEl);
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedLine(null);
        return;
      }

      if (event.key !== 'Tab' || focusTargets.length === 0) {
        return;
      }

      const first = focusTargets[0];
      const last = focusTargets[focusTargets.length - 1];

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

    drawerEl?.addEventListener('keydown', handleKeyDown);

    return () => {
      drawerEl?.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedLine, isVerifying]);

  const handleRowClick = (line: BankLine) => {
    setSelectedLine(line);
  };

  const handleVerifyRpt = async () => {
    if (!selectedLine?.rptId) {
      return;
    }

    try {
      setIsVerifying(true);
      const response = await fetch(`/audit/rpt/by-line/${selectedLine.id}`);
      if (!response.ok) {
        throw new Error('Failed to verify RPT');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsVerifying(false);
    }
  };

  const hasRpt = Boolean(selectedLine?.rptId);
  const drawerTitleId = selectedLine ? `bank-line-${selectedLine.id}` : undefined;

  return (
    <main className="space-y-6 bg-gray-50 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Bank lines</h1>
        <p className="mt-1 text-sm text-gray-500">Review and verify recent bank transactions.</p>
      </header>
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <Table<BankLine>
          columns={[
            {
              id: 'postedAt',
              header: 'Date',
              sortable: true,
              accessor: (line) => (
                <time dateTime={line.postedAt}>{formatDate(line.postedAt)}</time>
              ),
              value: (line) => new Date(line.postedAt),
            },
            { id: 'payee', header: 'Payee', sortable: true, accessor: (line) => line.payee },
            {
              id: 'amount',
              header: 'Amount',
              sortable: true,
              accessor: (line) => (
                <span className={line.amount < 0 ? 'text-red-600' : 'text-emerald-600'}>{formatCurrency(line.amount)}</span>
              ),
              value: (line) => line.amount,
              align: 'right',
            },
            {
              id: 'reference',
              header: 'Reference',
              accessor: (line) => line.reference,
            },
          ]}
          data={pageData}
          onRowClick={(line) => {
            lastFocusedElement.current = document.activeElement as HTMLElement;
            handleRowClick(line);
          }}
          getRowId={(line) => line.id}
          getRowAriaLabel={(line) =>
            `View details for ${line.payee} on ${formatDate(line.postedAt)} amount ${formatCurrency(line.amount)}`
          }
        />
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination controls">
          <button
            type="button"
            className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 disabled:opacity-50"
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
            disabled={page === 0}
          >
            Previous
          </button>
          <p className="text-sm text-gray-600">
            Page {page + 1} of {totalPages}
          </p>
          <button
            type="button"
            className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 disabled:opacity-50"
            onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </nav>
      </section>

      {selectedLine ? (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30" role="presentation">
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={drawerTitleId}
            className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl focus:outline-none"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={drawerTitleId} className="text-xl font-semibold text-gray-900">
                  {selectedLine.payee}
                </h2>
                <p className="text-sm text-gray-500">{formatDate(selectedLine.postedAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLine(null)}
                className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-500 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Amount</h3>
                <p className={`mt-1 text-lg font-medium ${selectedLine.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatCurrency(selectedLine.amount)}
                </p>
              </div>
              <dl className="grid grid-cols-1 gap-4 text-sm text-gray-600">
                <div>
                  <dt className="font-semibold text-gray-700">Reference</dt>
                  <dd className="mt-1">{selectedLine.reference}</dd>
                </div>
                {selectedLine.category ? (
                  <div>
                    <dt className="font-semibold text-gray-700">Category</dt>
                    <dd className="mt-1">{selectedLine.category}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleVerifyRpt}
                disabled={!hasRpt || isVerifying}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-200"
                title={hasRpt ? undefined : 'No RPT linked to this transaction'}
              >
                {isVerifying ? 'Verifying…' : 'Verify RPT'}
              </button>
              <a
                href="#"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                View in ledger
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
