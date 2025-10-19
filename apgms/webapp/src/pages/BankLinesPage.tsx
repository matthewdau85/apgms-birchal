import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Money from '../components/Money';
import DateText from '../components/DateText';
import { ErrorState, LoadingState } from '../components/Feedback';
import { getAuditReport, getBankLines, type AuditReport, type BankLine } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useFocusTrap } from '../hooks/useFocusTrap';

const BankLinesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [selectedLine, setSelectedLine] = useState<BankLine | null>(null);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const fetcher = useCallback(() => getBankLines(page), [page]);
  const { data, loading, error, reload } = useAsync(fetcher);

  const drawerRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(drawerRef, Boolean(selectedLine));

  const closeDrawer = useCallback(() => setSelectedLine(null), []);

  const loadAudit = useCallback((line: BankLine) => {
    setAuditLoading(true);
    setAuditReport(null);
    setAuditError(null);

    let cancelled = false;

    getAuditReport(line.id)
      .then((report) => {
        if (!cancelled) {
          setAuditReport(report);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAuditError(err instanceof Error ? err.message : 'Unable to load audit report');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuditLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedLine) {
      return;
    }
    return loadAudit(selectedLine);
  }, [selectedLine, loadAudit]);

  useEffect(() => {
    if (!selectedLine) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedLine, closeDrawer]);

  const tableContent = useMemo(() => {
    if (loading) {
      return <LoadingState message="Loading bank facilities…" />;
    }

    if (error || !data) {
      return <ErrorState message="We could not load bank facilities." onRetry={reload} />;
    }

    return (
      <>
        <div className="table-wrapper" role="region" aria-live="polite">
          <table>
            <thead>
              <tr>
                <th scope="col">Institution</th>
                <th scope="col">Limit</th>
                <th scope="col">Utilised</th>
                <th scope="col">Status</th>
                <th scope="col">Next review</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((line) => (
                <tr key={line.id}>
                  <td>{line.institution}</td>
                  <td>
                    <Money value={line.limit} />
                  </td>
                  <td>
                    <Money value={line.utilised} />
                  </td>
                  <td>
                    <span className="status-pill">{line.status}</span>
                  </td>
                  <td>
                    <DateText value={line.nextReview} />
                  </td>
                  <td>
                    <button type="button" onClick={() => setSelectedLine(line)}>
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination" aria-live="polite">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page === 1}>
            Previous
          </button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={data.page === data.totalPages}
          >
            Next
          </button>
        </div>
      </>
    );
  }, [data, error, loading, reload]);

  return (
    <div>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Bank line management</h1>
        <p style={{ color: 'var(--muted)' }}>Monitor and action drawdowns across your facilities.</p>
      </header>
      {tableContent}
      {selectedLine ? (
        <div className="drawer-overlay" role="presentation" onClick={closeDrawer}>
          <div
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            ref={drawerRef}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="drawer-title">{selectedLine.institution} facility</h2>
              <button type="button" className="close" aria-label="Close details" onClick={closeDrawer}>
                ×
              </button>
            </header>
            <p>
              Limit <Money value={selectedLine.limit} /> · Utilised <Money value={selectedLine.utilised} />
            </p>
            <p>
              Status <span className="status-pill">{selectedLine.status}</span>
            </p>
            <p>
              Next review <DateText value={selectedLine.nextReview} formatOptions={{ dateStyle: 'medium' }} />
            </p>
            <section aria-live="polite">
              {auditLoading ? (
                <LoadingState message="Fetching audit report…" />
              ) : auditError ? (
                <ErrorState
                  message={auditError}
                  onRetry={() => {
                    if (selectedLine) {
                      loadAudit(selectedLine);
                    }
                  }}
                />
              ) : auditReport ? (
                <>
                  <h3 style={{ marginBottom: '0.5rem' }}>Audit trail</h3>
                  <p>{auditReport.summary}</p>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    Last reviewed <DateText value={auditReport.lastReviewed} formatOptions={{ dateStyle: 'medium' }} />
                  </p>
                </>
              ) : null}
            </section>
            <div className="onboarding-actions">
              <button type="button">Request increase</button>
              <button type="button">Pause usage</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BankLinesPage;
