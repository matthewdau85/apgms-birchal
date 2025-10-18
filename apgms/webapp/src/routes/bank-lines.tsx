import * as React from "react";
import { useSearchParams } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

type BankLine = {
  id: string;
  date: string;
  payee: string;
  amount: number;
  description?: string;
};

type BankLinesResponse = {
  items: BankLine[];
  nextCursor: string | null;
  prevCursor: string | null;
};

const DATASET: BankLine[] = Array.from({ length: 45 }).map((_, index) => {
  const baseDate = new Date("2024-01-01T00:00:00Z");
  baseDate.setDate(baseDate.getDate() + index);
  return {
    id: `line-${index + 1}`,
    date: baseDate.toISOString(),
    payee: `Payee ${index + 1}`,
    amount: 100 + index * 3.5,
    description: `Line item ${index + 1} description.`,
  };
});

const DEFAULT_TAKE = 20;

async function fetchBankLines(
  orgId: string,
  take: number,
  cursor: string | null
): Promise<BankLinesResponse> {
  // Stubbed dataset grouped by org for demonstration purposes.
  // Pretend the orgId is part of the filter; the dataset is the same for all orgs.
  const sorted = [...DATASET];
  const startIndex = cursor ? parseInt(cursor, 10) : 0;
  const safeTake = Number.isFinite(take) && take > 0 ? take : DEFAULT_TAKE;
  const items = sorted.slice(startIndex, startIndex + safeTake);
  const nextIndex = startIndex + items.length;
  const prevIndex = Math.max(0, startIndex - safeTake);

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        items,
        nextCursor: nextIndex < sorted.length ? String(nextIndex) : null,
        prevCursor: startIndex > 0 ? String(prevIndex) : null,
      });
    }, 400);
  });
}

async function getRptByLine(lineId: string) {
  // Stubbed action to verify the RPT for a bank line.
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 300);
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return parsed.toLocaleDateString();
}

type FetchState =
  | { status: "idle" | "loading" }
  | { status: "success"; data: BankLinesResponse }
  | { status: "error"; error: Error };

export default function BankLinesRoute(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const orgId = searchParams.get("orgId");
  const takeParam = searchParams.get("take");
  const cursorParam = searchParams.get("cursor");

  const take = takeParam ? parseInt(takeParam, 10) || DEFAULT_TAKE : DEFAULT_TAKE;

  const [state, setState] = React.useState<FetchState>({ status: "idle" });
  const [selectedLine, setSelectedLine] = React.useState<BankLine | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);

  React.useEffect(() => {
    if (!orgId) {
      return;
    }

    let isMounted = true;
    setState({ status: "loading" });

    fetchBankLines(orgId, take, cursorParam)
      .then((data) => {
        if (!isMounted) return;
        setState({ status: "success", data });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        const err =
          error instanceof Error ? error : new Error("Failed to load bank lines");
        setState({ status: "error", error: err });
      });

    return () => {
      isMounted = false;
    };
  }, [orgId, take, cursorParam]);

  React.useEffect(() => {
    if (drawerOpen && headingRef.current) {
      headingRef.current.focus();
    }
  }, [drawerOpen]);

  const handleRetry = React.useCallback(() => {
    if (!orgId) return;
    setState({ status: "loading" });
    fetchBankLines(orgId, take, cursorParam)
      .then((data) => {
        setState({ status: "success", data });
      })
      .catch((error: unknown) => {
        const err =
          error instanceof Error ? error : new Error("Failed to load bank lines");
        setState({ status: "error", error: err });
      });
  }, [orgId, take, cursorParam]);

  const updateParam = React.useCallback(
    (key: string, value: string | null) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
        if (!params.has("take")) {
          params.set("take", String(take));
        }
        if (orgId) {
          params.set("orgId", orgId);
        }
        return params;
      }, { replace: true });
    },
    [setSearchParams, take, orgId]
  );

  const handleNext = React.useCallback(() => {
    if (state.status !== "success" || !state.data.nextCursor) return;
    updateParam("cursor", state.data.nextCursor);
  }, [state, updateParam]);

  const handlePrev = React.useCallback(() => {
    if (state.status !== "success") return;
    if (state.data.prevCursor) {
      updateParam("cursor", state.data.prevCursor);
    } else {
      updateParam("cursor", null);
    }
  }, [state, updateParam]);

  const handleRowClick = React.useCallback((line: BankLine) => {
    setSelectedLine(line);
    setDrawerOpen(true);
  }, []);

  const handleDrawerOpenChange = React.useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setSelectedLine(null);
    }
  }, []);

  const handleVerifyRpt = React.useCallback(async () => {
    if (!selectedLine) return;
    await getRptByLine(selectedLine.id);
  }, [selectedLine]);

  const renderTableBody = () => {
    if (state.status === "loading" || state.status === "idle") {
      return (
        <tbody>
          {Array.from({ length: Math.min(take, 5) }).map((_, index) => (
            <tr key={`skeleton-${index}`}>
              {Array.from({ length: 3 }).map((__, cellIndex) => (
                <td key={`skeleton-cell-${index}-${cellIndex}`}>
                  <div style={styles.skeletonCell} aria-hidden="true" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      );
    }

    if (state.status === "error") {
      return (
        <tbody>
          <tr>
            <td colSpan={3}>
              <div role="alert" style={styles.errorAlert}>
                <p>{state.error.message}</p>
                <button type="button" onClick={handleRetry} style={styles.button}>
                  Retry
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      );
    }

    if (state.data.items.length === 0) {
      return (
        <tbody>
          <tr>
            <td colSpan={3} style={styles.emptyState}>
              No bank lines yet
            </td>
          </tr>
        </tbody>
      );
    }

    return (
      <tbody>
        {state.data.items.map((line) => (
          <tr
            key={line.id}
            onClick={() => handleRowClick(line)}
            style={styles.clickableRow}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleRowClick(line);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`View details for bank line ${line.payee}`}
          >
            <td>{formatDate(line.date)}</td>
            <td>{line.payee}</td>
            <td>{formatCurrency(line.amount)}</td>
          </tr>
        ))}
      </tbody>
    );
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Bank Lines</h1>
        {!orgId && (
          <p style={styles.missingOrg}>
            Please provide an <code>orgId</code> query parameter.
          </p>
        )}
      </header>

      {orgId && (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.headerCell}>Date</th>
                <th style={styles.headerCell}>Payee</th>
                <th style={styles.headerCell}>Amount</th>
              </tr>
            </thead>
            {renderTableBody()}
          </table>

          <div style={styles.paginationControls}>
            <button
              type="button"
              onClick={handlePrev}
              style={{
                ...styles.button,
                ...(state.status === "success" && state.data.prevCursor
                  ? {}
                  : styles.disabledButton),
              }}
              disabled={
                state.status !== "success" || (!state.data.prevCursor && !cursorParam)
              }
            >
              Prev
            </button>
            <button
              type="button"
              onClick={handleNext}
              style={{
                ...styles.button,
                ...(state.status === "success" && state.data.nextCursor
                  ? {}
                  : styles.disabledButton),
              }}
              disabled={state.status !== "success" || !state.data.nextCursor}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <Dialog.Root open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay style={styles.dialogOverlay} />
          <Dialog.Content style={styles.dialogContent}>
            <VisuallyHidden>
              <Dialog.Title>Bank line details</Dialog.Title>
            </VisuallyHidden>
            <div>
              <h2
                ref={headingRef}
                tabIndex={-1}
                style={styles.drawerHeading}
              >
                Bank Line Details
              </h2>
              {selectedLine ? (
                <div style={styles.drawerBody}>
                  <dl style={styles.definitionList}>
                    <div style={styles.definitionRow}>
                      <dt>Date</dt>
                      <dd>{formatDate(selectedLine.date)}</dd>
                    </div>
                    <div style={styles.definitionRow}>
                      <dt>Payee</dt>
                      <dd>{selectedLine.payee}</dd>
                    </div>
                    <div style={styles.definitionRow}>
                      <dt>Amount</dt>
                      <dd>{formatCurrency(selectedLine.amount)}</dd>
                    </div>
                    {selectedLine.description && (
                      <div style={styles.definitionRow}>
                        <dt>Description</dt>
                        <dd>{selectedLine.description}</dd>
                      </div>
                    )}
                  </dl>
                  <button type="button" onClick={handleVerifyRpt} style={styles.button}>
                    Verify RPT
                  </button>
                </div>
              ) : (
                <p style={styles.drawerBody}>Select a bank line to view details.</p>
              )}
            </div>
            <Dialog.Close asChild>
              <button type="button" style={styles.closeButton}>
                Close
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    padding: "1.5rem",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  title: {
    margin: 0,
    fontSize: "1.75rem",
  },
  missingOrg: {
    color: "#c00",
  },
  tableContainer: {
    border: "1px solid #ddd",
    borderRadius: "0.75rem",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  headerCell: {
    textAlign: "left",
    padding: "0.75rem",
    backgroundColor: "#f6f6f6",
    borderBottom: "1px solid #ddd",
  },
  skeletonCell: {
    height: "1.125rem",
    backgroundColor: "#e0e0e0",
    borderRadius: "0.25rem",
  },
  clickableRow: {
    cursor: "pointer",
  },
  paginationControls: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.5rem",
    padding: "0.75rem",
    borderTop: "1px solid #ddd",
    backgroundColor: "#fafafa",
  },
  button: {
    padding: "0.5rem 1rem",
    borderRadius: "0.5rem",
    border: "1px solid #333",
    backgroundColor: "#fff",
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  emptyState: {
    padding: "2rem",
    textAlign: "center",
    color: "#666",
  },
  errorAlert: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    padding: "1rem",
    borderRadius: "0.5rem",
  },
  dialogOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  dialogContent: {
    position: "fixed",
    top: 0,
    right: 0,
    height: "100%",
    width: "22rem",
    backgroundColor: "#fff",
    boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    overflowY: "auto",
  },
  drawerHeading: {
    margin: 0,
    fontSize: "1.5rem",
    outline: "none",
  },
  drawerBody: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  definitionList: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    rowGap: "0.5rem",
    columnGap: "1rem",
    margin: 0,
  },
  definitionRow: {
    display: "contents",
  },
  closeButton: {
    alignSelf: "flex-end",
    padding: "0.5rem 1rem",
    borderRadius: "0.5rem",
    border: "1px solid #333",
    backgroundColor: "#fff",
    cursor: "pointer",
  },
};

