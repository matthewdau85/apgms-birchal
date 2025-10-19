import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { api, BankLine } from "../lib/api";
import { Money } from "../ui/Money";
import { DateText } from "../ui/DateText";

type LoadState = "idle" | "loading" | "error" | "success";

type DrawerState = {
  line: BankLine | null;
  verifying: boolean;
  message: string | null;
  error: string | null;
};

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function BankLinesRoute() {
  const [state, setState] = useState<LoadState>("idle");
  const [rows, setRows] = useState<BankLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<Array<string | null>>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(null);
  const [drawer, setDrawer] = useState<DrawerState>({ line: null, verifying: false, message: null, error: null });
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(cursor: string | null) {
      setState("loading");
      setError(null);
      try {
        const response = await api.bankLines({ cursor, take: 10 });
        if (cancelled) {
          return;
        }
        setRows(response.items);
        setNextCursor(response.nextCursor ?? null);
        setState("success");
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load bank lines");
        setState("error");
      }
    }
    load(currentCursor);
    return () => {
      cancelled = true;
    };
  }, [currentCursor]);

  const openDrawer = useCallback((line: BankLine) => {
    setDrawer({ line, verifying: false, message: null, error: null });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawer((prev) => ({ ...prev, line: null }));
  }, []);

  useEffect(() => {
    const activeLine = drawer.line;
    if (!activeLine) {
      const previous = previouslyFocusedElement.current;
      if (previous) {
        previous.focus();
      }
      return;
    }

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;
    const dialog = drawerRef.current;
    if (!dialog) {
      return;
    }

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key === "Tab" && focusable.length > 0) {
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawer.line, closeDrawer]);

  const handleVerify = async () => {
    if (!drawer.line) {
      return;
    }
    setDrawer((prev) => ({ ...prev, verifying: true, error: null, message: null }));
    try {
      await api.verifyAudit({ id: drawer.line.id });
      setDrawer((prev) => ({ ...prev, verifying: false, message: "Verification sent", error: null }));
    } catch (err) {
      setDrawer((prev) => ({
        ...prev,
        verifying: false,
        error: err instanceof Error ? err.message : "Unable to verify",
        message: null,
      }));
    }
  };

  const nextDisabled = !nextCursor;
  const previousDisabled = previousCursors.length === 0;

  const statusBadge = useMemo(() => {
    return new Map<BankLine["status"], { label: string; color: string }>([
      ["pending", { label: "Pending", color: "#f59e0b" }],
      ["verified", { label: "Verified", color: "#10b981" }],
      ["flagged", { label: "Flagged", color: "#ef4444" }],
    ]);
  }, []);

  const handleNextPage = () => {
    if (!nextCursor) {
      return;
    }
    setPreviousCursors((prev) => [...prev, currentCursor]);
    setCurrentCursor(nextCursor);
  };

  const handlePreviousPage = () => {
    setPreviousCursors((prev) => {
      if (!prev.length) {
        return prev;
      }
      const updated = [...prev];
      const cursor = updated.pop() ?? null;
      setCurrentCursor(cursor);
      return updated;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <header>
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Bank feeds</h2>
        <p style={{ margin: "0.25rem 0 0", color: "#475569" }}>
          Review incoming lines and verify reconciliation matches.
        </p>
      </header>
      {state === "error" && (
        <div role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
          {error ?? "Unable to load bank lines"}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <caption style={visuallyHiddenStyle}>Bank line items</caption>
          <thead>
            <tr>
              <th scope="col" style={headerCellStyle}>
                Line
              </th>
              <th scope="col" style={headerCellStyle}>
                Amount
              </th>
              <th scope="col" style={headerCellStyle}>
                Status
              </th>
              <th scope="col" style={headerCellStyle}>
                Updated
              </th>
              <th scope="col" style={headerCellStyle}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {state === "loading" && (
              <tr>
                <td colSpan={5} style={bodyCellStyle}>
                  Loading bank lines…
                </td>
              </tr>
            )}
            {state === "success" && rows.length === 0 && (
              <tr>
                <td colSpan={5} style={bodyCellStyle}>
                  No bank lines available.
                </td>
              </tr>
            )}
            {rows.map((line) => {
              const badge = statusBadge.get(line.status);
              return (
                <tr key={line.id}>
                  <th scope="row" style={{ ...bodyCellStyle, fontWeight: 600 }}>
                    <button
                      type="button"
                      onClick={(event) => {
                        previouslyFocusedElement.current = event.currentTarget;
                        openDrawer(line);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "inherit",
                        textAlign: "left",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      {line.name}
                    </button>
                  </th>
                  <td style={bodyCellStyle}>
                    <Money value={line.amount} />
                  </td>
                  <td style={bodyCellStyle}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: badge?.color ?? "#0f172a",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: "0.5rem",
                          height: "0.5rem",
                          borderRadius: "9999px",
                          background: badge?.color ?? "#0f172a",
                          display: "inline-block",
                        }}
                      />
                      {badge?.label ?? line.status}
                    </span>
                  </td>
                  <td style={bodyCellStyle}>
                    <DateText value={line.updatedAt} />
                  </td>
                  <td style={bodyCellStyle}>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        previouslyFocusedElement.current = event.currentTarget as HTMLElement;
                        openDrawer(line);
                      }}
                      style={actionButtonStyle}
                    >
                      View details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={handlePreviousPage}
          disabled={previousDisabled}
          style={{
            ...pagerButtonStyle,
            opacity: previousDisabled ? 0.5 : 1,
            cursor: previousDisabled ? "not-allowed" : "pointer",
          }}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={handleNextPage}
          disabled={nextDisabled}
          style={{
            ...pagerButtonStyle,
            opacity: nextDisabled ? 0.5 : 1,
            cursor: nextDisabled ? "not-allowed" : "pointer",
          }}
        >
          Next
        </button>
      </div>
      {drawer.line ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bank-line-title"
            style={{
              width: "min(28rem, 90vw)",
              background: "#ffffff",
              height: "100%",
              padding: "2rem",
              boxShadow: "-12px 0 30px rgba(15, 23, 42, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 id="bank-line-title" style={{ margin: 0, fontSize: "1.25rem" }}>
                  {drawer.line.name}
                </h3>
                <p style={{ margin: "0.25rem 0 0", color: "#475569" }}>Review and verify this bank line.</p>
              </div>
              <button type="button" onClick={closeDrawer} style={actionButtonStyle}>
                Close
              </button>
            </div>
            <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.5rem 1rem" }}>
              <dt style={definitionTitleStyle}>Amount</dt>
              <dd style={definitionValueStyle}>
                <Money value={drawer.line.amount} style={{ fontSize: "1.25rem", fontWeight: 700 }} />
              </dd>
              <dt style={definitionTitleStyle}>Status</dt>
              <dd style={definitionValueStyle}>{drawer.line.status}</dd>
              <dt style={definitionTitleStyle}>Last updated</dt>
              <dd style={definitionValueStyle}>
                <DateText value={drawer.line.updatedAt} />
              </dd>
              <dt style={definitionTitleStyle}>Reference</dt>
              <dd style={definitionValueStyle}>{drawer.line.id}</dd>
            </dl>
            {drawer.error ? (
              <div role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
                {drawer.error}
              </div>
            ) : null}
            {drawer.message ? (
              <div role="status" style={{ color: "#15803d", fontWeight: 600 }}>
                {drawer.message}
              </div>
            ) : null}
            <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleVerify}
                style={{
                  ...actionButtonStyle,
                  fontWeight: 700,
                  opacity: drawer.verifying ? 0.6 : 1,
                  cursor: drawer.verifying ? "wait" : "pointer",
                }}
                disabled={drawer.verifying}
              >
                {drawer.verifying ? "Verifying…" : "Verify"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const headerCellStyle: CSSProperties = {
  textAlign: "left",
  padding: "0.75rem 0.75rem 0.5rem",
  fontSize: "0.875rem",
  color: "#475569",
  fontWeight: 600,
  borderBottom: "2px solid rgba(148, 163, 184, 0.4)",
};

const bodyCellStyle: CSSProperties = {
  padding: "0.75rem",
  borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
  fontSize: "0.95rem",
};

const actionButtonStyle: CSSProperties = {
  borderRadius: "0.5rem",
  border: "1px solid rgba(148, 163, 184, 0.6)",
  padding: "0.4rem 0.9rem",
  background: "#0ea5e9",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "0.9rem",
};

const pagerButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  background: "#1e293b",
};

const definitionTitleStyle: CSSProperties = {
  fontWeight: 600,
  color: "#475569",
};

const definitionValueStyle: CSSProperties = {
  margin: 0,
};

const visuallyHiddenStyle: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};
