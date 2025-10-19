import React, { FormEvent, useCallback, useId, useMemo, useState } from "react";

type Allocation = {
  account: string;
  amount: number;
  currency?: string;
};

type AuditRecord = {
  rptId: string;
  bankLineId: string;
  allocations: Allocation[];
  verifyStatus: "Verified" | "Failed" | string;
  timestamp: string;
};

type AuditBlob = {
  id: string;
  createdAt: string;
  payload: unknown;
};

type AuditResponse = {
  record: AuditRecord | null;
  blobs: AuditBlob[];
};

type SearchMode = "rpt" | "bankLine";

type SanitizedValue = {
  sanitized: unknown;
  hidden: Record<string, unknown>;
};

const SENSITIVE_KEYS = new Set(["signature", "prevHash", "privateKey", "internalHash"]);

function sanitizeValue(value: unknown, path = ""): SanitizedValue {
  if (value === null || typeof value !== "object") {
    return { sanitized: value, hidden: {} };
  }

  if (Array.isArray(value)) {
    const sanitizedArray: unknown[] = [];
    const hidden: Record<string, unknown> = {};
    value.forEach((item, index) => {
      const { sanitized, hidden: childHidden } = sanitizeValue(item, path ? `${path}[${index}]` : `[${index}]`);
      sanitizedArray.push(sanitized);
      Object.assign(hidden, childHidden);
    });
    return { sanitized: sanitizedArray, hidden };
  }

  const sanitizedObject: Record<string, unknown> = {};
  const hidden: Record<string, unknown> = {};

  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    const nextPath = path ? `${path}.${key}` : key;
    const { sanitized, hidden: childHidden } = sanitizeValue(child, nextPath);

    if (SENSITIVE_KEYS.has(key)) {
      hidden[nextPath] = child;
    } else {
      sanitizedObject[key] = sanitized;
    }

    Object.assign(hidden, childHidden);
  });

  return { sanitized: sanitizedObject, hidden };
}

function jsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return "<unable to render JSON>";
  }
}

const statusStyles: Record<string, React.CSSProperties> = {
  Verified: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
  },
  Failed: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
  },
};

export default function AuditRoute() {
  const [searchMode, setSearchMode] = useState<SearchMode>("rpt");
  const [searchTerm, setSearchTerm] = useState("");
  const [response, setResponse] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedBlobId, setCopiedBlobId] = useState<string | null>(null);
  const inputId = useId();

  const searchLabel = searchMode === "rpt" ? "RPT ID" : "Bank Line ID";

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setCopiedBlobId(null);

      const trimmed = searchTerm.trim();
      if (!trimmed) {
        setError("Enter an ID before searching.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const queryKey = searchMode === "rpt" ? "rptId" : "bankLineId";
        const request = await fetch(`/api/audit?${queryKey}=${encodeURIComponent(trimmed)}`);

        if (!request.ok) {
          throw new Error(`Search failed (${request.status})`);
        }

        const data: AuditResponse = await request.json();
        setResponse(data);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Unknown error";
        setResponse(null);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [searchMode, searchTerm]
  );

  const record = response?.record ?? null;
  const blobs = response?.blobs ?? [];

  const statusStyle = useMemo(() => {
    if (!record) return undefined;
    return statusStyles[record.verifyStatus] ?? {
      backgroundColor: "#E0E7FF",
      color: "#1E3A8A",
    };
  }, [record]);

  const handleCopy = useCallback(async (blob: AuditBlob) => {
    const { sanitized } = sanitizeValue(blob.payload);
    const text = jsonStringify(sanitized);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedBlobId(blob.id);
      window.setTimeout(() => setCopiedBlobId((current) => (current === blob.id ? null : current)), 2000);
    } catch (copyError) {
      const message = copyError instanceof Error ? copyError.message : "Unable to copy";
      setError(message);
    }
  }, []);

  return (
    <main style={{ padding: "2rem 1rem", maxWidth: "72rem", margin: "0 auto" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.875rem", lineHeight: 1.2, fontWeight: 600 }}>Audit trail</h1>
        <p style={{ color: "#4B5563", marginTop: "0.5rem" }}>
          Search by {searchMode === "rpt" ? "RPT ID" : "Bank Line ID"} to review verification status and recent audit blobs.
        </p>
      </header>

      <section aria-labelledby="search-heading" style={{ marginBottom: "2rem" }}>
        <h2 id="search-heading" style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
          Search audit records
        </h2>
        <div role="tablist" aria-label="Search mode" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <button
            type="button"
            role="tab"
            aria-selected={searchMode === "rpt"}
            onClick={() => setSearchMode("rpt")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid",
              borderColor: searchMode === "rpt" ? "#4F46E5" : "#D1D5DB",
              backgroundColor: searchMode === "rpt" ? "#EEF2FF" : "white",
              color: searchMode === "rpt" ? "#312E81" : "#111827",
              fontWeight: searchMode === "rpt" ? 600 : 500,
              cursor: "pointer",
            }}
          >
            By RPT ID
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={searchMode === "bankLine"}
            onClick={() => setSearchMode("bankLine")}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid",
              borderColor: searchMode === "bankLine" ? "#4F46E5" : "#D1D5DB",
              backgroundColor: searchMode === "bankLine" ? "#EEF2FF" : "white",
              color: searchMode === "bankLine" ? "#312E81" : "#111827",
              fontWeight: searchMode === "bankLine" ? 600 : 500,
              cursor: "pointer",
            }}
          >
            By Bank Line ID
          </button>
        </div>

        <form onSubmit={onSubmit} aria-live="polite" style={{ display: "grid", gap: "1rem", maxWidth: "32rem" }}>
          <label htmlFor={inputId} style={{ fontWeight: 600 }}>
            {searchLabel}
          </label>
          <input
            id={inputId}
            name="search"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            autoComplete="off"
            placeholder={`Enter ${searchLabel}`}
            aria-describedby={error ? "search-error" : undefined}
            style={{
              borderRadius: "0.5rem",
              border: "1px solid #D1D5DB",
              padding: "0.75rem 1rem",
              fontSize: "1rem",
              lineHeight: 1.5,
            }}
          />
          {error ? (
            <p id="search-error" role="alert" style={{ color: "#B91C1C", fontSize: "0.875rem" }}>
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: "#4F46E5",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            {isLoading ? "Searching…" : "Search"}
          </button>
        </form>
      </section>

      {record ? (
        <section aria-labelledby="record-heading" style={{ marginBottom: "2rem" }}>
          <h2 id="record-heading" style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
            Verification overview
          </h2>
          <div
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              display: "grid",
              gap: "1rem",
              backgroundColor: "white",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>RPT ID</p>
                <p style={{ fontSize: "1rem", fontWeight: 600 }}>{record.rptId}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>Bank Line ID</p>
                <p style={{ fontSize: "1rem", fontWeight: 600 }}>{record.bankLineId}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>Verified</p>
                <span
                  style={{
                    ...statusStyle,
                    borderRadius: "9999px",
                    padding: "0.25rem 0.75rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  {record.verifyStatus}
                </span>
              </div>
              <div>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>Last updated</p>
                <p style={{ fontSize: "1rem", fontWeight: 600 }}>
                  {new Date(record.timestamp).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Allocations</h3>
              {record.allocations.length ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "0.5rem", fontSize: "0.875rem", color: "#6B7280" }}>Account</th>
                        <th style={{ textAlign: "left", padding: "0.5rem", fontSize: "0.875rem", color: "#6B7280" }}>Amount</th>
                        <th style={{ textAlign: "left", padding: "0.5rem", fontSize: "0.875rem", color: "#6B7280" }}>Currency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.allocations.map((allocation, index) => (
                        <tr key={`${allocation.account}-${index}`}>
                          <td style={{ padding: "0.5rem", borderTop: "1px solid #E5E7EB" }}>{allocation.account}</td>
                          <td style={{ padding: "0.5rem", borderTop: "1px solid #E5E7EB" }}>{allocation.amount}</td>
                          <td style={{ padding: "0.5rem", borderTop: "1px solid #E5E7EB" }}>{allocation.currency ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: "#6B7280" }}>No allocations recorded.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="blobs-heading" style={{ marginBottom: "4rem" }}>
        <h2 id="blobs-heading" style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
          Recent audit blobs
        </h2>
        {blobs.length ? (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1.5rem" }}>
            {blobs.map((blob) => {
              const { sanitized, hidden } = sanitizeValue(blob.payload);
              const safeJson = jsonStringify(sanitized);
              const hiddenJson = Object.keys(hidden).length ? jsonStringify(hidden) : null;

              return (
                <li
                  key={blob.id}
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                    backgroundColor: "white",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                    <div>
                      <p style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.25rem" }}>Blob ID</p>
                      <p style={{ fontWeight: 600 }}>{blob.id}</p>
                      <p style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem" }}>
                        {new Date(blob.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(blob)}
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                        border: "1px solid #D1D5DB",
                        backgroundColor: "white",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {copiedBlobId === blob.id ? "Copied" : "Copy JSON"}
                    </button>
                  </div>
                  <div
                    role="region"
                    aria-label={`Audit blob ${blob.id}`}
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      marginTop: "1rem",
                      padding: "1rem",
                      backgroundColor: "#F9FAFB",
                      borderRadius: "0.5rem",
                      border: "1px solid #E5E7EB",
                    }}
                  >
                    {safeJson}
                  </div>
                  {hiddenJson ? (
                    <details style={{ marginTop: "1rem" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 600 }}>Advanced fields</summary>
                      <div
                        style={{
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          marginTop: "0.75rem",
                          padding: "1rem",
                          backgroundColor: "#F3F4F6",
                          borderRadius: "0.5rem",
                          border: "1px solid #E5E7EB",
                        }}
                      >
                        {hiddenJson}
                      </div>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ color: "#6B7280" }}>Search to load recent audit blobs.</p>
        )}
      </section>
    </main>
  );
}
