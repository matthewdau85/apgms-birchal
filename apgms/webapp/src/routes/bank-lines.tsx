import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '../lib/api';

type BankLine = {
  id: string;
  date: string;
  payee: string;
  amount: number;
};

type VerificationResponse = {
  verified: boolean;
  timestamp: string;
};

type RequestStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

type VerificationStatus = 'idle' | 'loading' | 'success' | 'error';

type DrawerState = {
  line: BankLine;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(value),
  );
}

const focusableSelectors = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function BankLines(): JSX.Element {
  const [lines, setLines] = useState<BankLine[]>([]);
  const [status, setStatus] = useState<RequestStatus>('loading');
  const [error, setError] = useState('');
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [verificationResult, setVerificationResult] = useState<VerificationResponse | null>(null);
  const [verificationError, setVerificationError] = useState('');
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchJson<BankLine[]>('/bank-lines')
      .then((response) => {
        if (cancelled) return;
        if (!response.length) {
          setStatus('empty');
          setLines([]);
          return;
        }
        setLines(response);
        setStatus('success');
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!drawerState) return;

    const container = drawerRef.current;
    if (!container) return;

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
    focusable[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key === 'Tab' && focusable.length) {
        const currentFocusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
        const first = currentFocusable[0];
        const last = currentFocusable[currentFocusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerState]);

  const openDrawer = (line: BankLine, trigger: HTMLElement) => {
    lastTriggerRef.current = trigger;
    setDrawerState({ line });
    setVerificationStatus('idle');
    setVerificationResult(null);
    setVerificationError('');
  };

  const closeDrawer = () => {
    setDrawerState(null);
    Promise.resolve().then(() => {
      lastTriggerRef.current?.focus();
    });
  };

  const handleVerify = async () => {
    if (!drawerState) return;
    setVerificationStatus('loading');
    setVerificationError('');
    try {
      const response = await fetchJson<VerificationResponse>(`/audit/rpt/by-line/${drawerState.line.id}`);
      setVerificationResult(response);
      setVerificationStatus('success');
    } catch (err) {
      setVerificationStatus('error');
      setVerificationResult(null);
      setVerificationError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const totalAmount = useMemo(
    () =>
      lines.reduce((accumulator, line) => {
        return accumulator + line.amount;
      }, 0),
    [lines],
  );

  if (status === 'loading') {
    return (
      <section aria-busy="true" aria-live="polite" className="bank-lines bank-lines--loading">
        <header className="bank-lines__header">
          <h1>Bank lines</h1>
          <p>Loading recent activity…</p>
        </header>
        <div className="bank-lines__skeleton" />
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section role="alert" className="bank-lines bank-lines--error">
        <header className="bank-lines__header">
          <h1>Bank lines</h1>
          <p>We were unable to load transactions.</p>
        </header>
        <p>{error}</p>
      </section>
    );
  }

  if (status === 'empty') {
    return (
      <section className="bank-lines bank-lines--empty">
        <header className="bank-lines__header">
          <h1>Bank lines</h1>
          <p>No bank lines to display.</p>
        </header>
        <p>Connect a financial account to see activity.</p>
      </section>
    );
  }

  return (
    <section className="bank-lines" aria-live="polite">
      <header className="bank-lines__header">
        <h1>Bank lines</h1>
        <p>Total across lines: {formatCurrency(totalAmount)}</p>
      </header>

      <div role="region" aria-label="Bank line transactions">
        <table role="table" className="bank-lines__table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Payee</th>
              <th scope="col">Amount</th>
              <th scope="col" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>{formatDate(line.date)}</td>
                <td>{line.payee}</td>
                <td>{formatCurrency(line.amount)}</td>
                <td>
                  <button
                    type="button"
                    onClick={(event) => openDrawer(line, event.currentTarget)}
                    aria-label={`View ${line.payee} details`}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawerState && (
        <div role="presentation" className="bank-lines__drawer-overlay">
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="bank-line-drawer-title"
            className="bank-lines__drawer"
            ref={drawerRef}
          >
            <header>
              <h2 id="bank-line-drawer-title">{drawerState.line.payee}</h2>
              <p>
                {formatDate(drawerState.line.date)} · {formatCurrency(drawerState.line.amount)}
              </p>
            </header>
            <div className="bank-lines__drawer-content" aria-live="polite">
              <button type="button" onClick={handleVerify} disabled={verificationStatus === 'loading'}>
                {verificationStatus === 'loading' ? 'Verifying…' : 'Verify RPT'}
              </button>

              {verificationStatus === 'success' && verificationResult && (
                <dl className="bank-lines__verification">
                  <div>
                    <dt>Status</dt>
                    <dd>{verificationResult.verified ? 'Verified' : 'Not verified'}</dd>
                  </div>
                  <div>
                    <dt>Timestamp</dt>
                    <dd>{new Date(verificationResult.timestamp).toLocaleString()}</dd>
                  </div>
                </dl>
              )}

              {verificationStatus === 'error' && (
                <p role="alert">{verificationError}</p>
              )}
            </div>
            <footer>
              <button type="button" onClick={closeDrawer}>
                Close
              </button>
            </footer>
          </aside>
        </div>
      )}
    </section>
  );
}
