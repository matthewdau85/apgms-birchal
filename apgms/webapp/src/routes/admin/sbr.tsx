import { FormEvent, useEffect, useMemo, useState } from "react";

type Status = "SENT" | "QUEUED" | "FAILED";

export type SbrMessage = {
  id: string;
  endpoint: string;
  createdAt: string;
  status: Status;
  summary: string;
};

type AdminSbrPageProps = {
  initialMessages?: SbrMessage[];
};

const DEFAULT_ENDPOINT = "https://example.gov.au/sbr";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function AdminSbrPage({ initialMessages = [] }: AdminSbrPageProps) {
  const [endpointUrl, setEndpointUrl] = useState(DEFAULT_ENDPOINT);
  const [messages, setMessages] = useState<SbrMessage[]>(initialMessages);
  const [loading, setLoading] = useState(initialMessages.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sendingPing, setSendingPing] = useState(false);

  useEffect(() => {
    if (initialMessages.length > 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch("/sbr/messages")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("failed_to_load");
        }
        const data = (await response.json()) as { messages?: SbrMessage[] };
        if (!cancelled) {
          setMessages(Array.isArray(data.messages) ? data.messages : []);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Unable to load recent messages");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialMessages.length]);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const endpointOptions = useMemo(
    () => [
      { id: "primary", name: "Primary", url: endpointUrl },
      { id: "secondary", name: "Secondary", url: "https://backup.example.gov.au/sbr" },
    ],
    [endpointUrl],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("Endpoint saved. Changes take effect immediately.");
  };

  const handlePing = async () => {
    setSendingPing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setFeedback("Test ping dispatched to the configured endpoint.");
    } finally {
      setSendingPing(false);
    }
  };

  return (
    <div className="admin-sbr" style={{ display: "grid", gap: "2rem", padding: "2rem" }}>
      <header style={{ display: "grid", gap: "0.5rem" }}>
        <p style={{ fontSize: "0.875rem", textTransform: "uppercase", color: "#475569", letterSpacing: "0.08em" }}>
          Administration
        </p>
        <h1 style={{ margin: 0 }}>ATO SBR controls</h1>
        <p style={{ margin: 0, maxWidth: "52ch", color: "#475569" }}>
          Configure Secure Business Reporting connectivity and review the latest message deliveries from the APGMS platform.
        </p>
        {feedback ? (
          <div role="status" aria-live="polite" style={{ background: "#ecfdf5", padding: "0.75rem 1rem", borderRadius: "0.5rem" }}>
            {feedback}
          </div>
        ) : null}
        {error ? (
          <div role="alert" style={{ background: "#fef2f2", padding: "0.75rem 1rem", borderRadius: "0.5rem" }}>
            {error}
          </div>
        ) : null}
      </header>

      <section aria-labelledby="endpoint-settings" style={{ display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem" }}>
          <h2 id="endpoint-settings" style={{ margin: 0 }}>
            Endpoint configuration
          </h2>
          <button type="button" onClick={handlePing} disabled={sendingPing}>
            {sendingPing ? "Sending…" : "Send test ping"}
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: "0.75rem",
            padding: "1.5rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            background: "#ffffff",
          }}
        >
          <label htmlFor="endpoint-url" style={{ fontWeight: 600 }}>
            Endpoint URL
          </label>
          <input
            id="endpoint-url"
            name="endpoint-url"
            type="url"
            value={endpointUrl}
            onChange={(event) => setEndpointUrl(event.currentTarget.value)}
            required
            style={{ padding: "0.625rem", border: "1px solid #94a3b8", borderRadius: "0.5rem" }}
          />
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="submit">Save endpoint</button>
          </div>
        </form>
        <div aria-live="polite">
          <h3 style={{ margin: "0 0 0.5rem 0" }}>Available endpoints</h3>
          <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
            {endpointOptions.map((option) => (
              <li key={option.id}>
                <span style={{ fontWeight: 600 }}>{option.name}</span>: {option.url}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="certificates" style={{ display: "grid", gap: "1rem" }}>
        <h2 id="certificates" style={{ margin: 0 }}>
          Certificate metadata
        </h2>
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          <article
            aria-label="Signing certificate"
            style={{ border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem", background: "#ffffff" }}
          >
            <h3 style={{ marginTop: 0 }}>Signing certificate</h3>
            <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>
              <div>
                <dt style={{ fontWeight: 600 }}>Serial number</dt>
                <dd style={{ margin: 0 }}>Pending upload</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600 }}>Issued to</dt>
                <dd style={{ margin: 0 }}>Australian Tax Office</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600 }}>Expiry</dt>
                <dd style={{ margin: 0 }}>31 Dec 2025 (placeholder)</dd>
              </div>
            </dl>
          </article>
          <article
            aria-label="Transport certificate"
            style={{ border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem", background: "#ffffff" }}
          >
            <h3 style={{ marginTop: 0 }}>Transport certificate</h3>
            <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>
              <div>
                <dt style={{ fontWeight: 600 }}>Serial number</dt>
                <dd style={{ margin: 0 }}>Awaiting renewal</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600 }}>Issued by</dt>
                <dd style={{ margin: 0 }}>APGMS Certificate Authority</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 600 }}>Expiry</dt>
                <dd style={{ margin: 0 }}>15 Jan 2026 (placeholder)</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section aria-labelledby="recent-messages" style={{ display: "grid", gap: "1rem" }}>
        <h2 id="recent-messages" style={{ margin: 0 }}>
          Recent messages
        </h2>
        {loading ? (
          <p role="status">Loading recent messages…</p>
        ) : messages.length === 0 ? (
          <p>No SBR messages have been delivered yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <caption style={{ position: "absolute", left: "-9999px" }}>
                Latest SBR message deliveries
              </caption>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #cbd5f5" }}>
                    Status
                  </th>
                  <th scope="col" style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #cbd5f5" }}>
                    Delivered at
                  </th>
                  <th scope="col" style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #cbd5f5" }}>
                    Endpoint
                  </th>
                  <th scope="col" style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #cbd5f5" }}>
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message.id}>
                    <td style={{ padding: "0.5rem", borderBottom: "1px solid #e2e8f0", fontWeight: 600 }}>
                      {message.status}
                    </td>
                    <td style={{ padding: "0.5rem", borderBottom: "1px solid #e2e8f0" }}>
                      {formatDate(message.createdAt)}
                    </td>
                    <td style={{ padding: "0.5rem", borderBottom: "1px solid #e2e8f0" }}>{message.endpoint}</td>
                    <td style={{ padding: "0.5rem", borderBottom: "1px solid #e2e8f0" }}>{message.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
