import React, { useEffect, useMemo, useState } from "react";

type ObligationType = "BAS" | "PAYGW";

type ObligationResponse = {
  obligations: ObligationItem[];
  cashOnHandCents: number;
};

type ObligationItem = {
  type: ObligationType;
  period: string;
  dueDate: string;
  forecastCents: number;
  band: {
    p50: number;
    p80: number;
    p90: number;
  };
};

const ORG_ID = "org-1";

const currency = (value: number) =>
  (value / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" });

export const ObligationsPage: React.FC = () => {
  const [data, setData] = useState<ObligationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [growth, setGrowth] = useState(0);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [threshold, setThreshold] = useState(20000);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/obligations/upcoming?orgId=${ORG_ID}`);
        if (!response.ok) {
          throw new Error(`Failed to load obligations (${response.status})`);
        }
        const payload = (await response.json()) as ObligationResponse;
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load obligations");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const adjustedObligations = useMemo(() => {
    if (!data) {
      return [] as ObligationItem[];
    }
    const factor = 1 + growth / 100;
    return data.obligations.map((item) => ({
      ...item,
      forecastCents: Math.round(item.forecastCents * factor),
      band: {
        p50: Math.round(item.band.p50 * factor),
        p80: Math.round(item.band.p80 * factor),
        p90: Math.round(item.band.p90 * factor),
      },
    }));
  }, [data, growth]);

  const handleToggleAlert = async () => {
    const nextEnabled = !alertEnabled;
    setAlertEnabled(nextEnabled);
    if (!nextEnabled) {
      return;
    }
    try {
      await fetch("/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: ORG_ID,
          email: "ops@example.com",
          thresholdCents: Math.round(threshold * 100),
        }),
      });
    } catch (err) {
      console.error("Failed to subscribe to alerts", err);
    }
  };

  const calendarRows = useMemo(() => {
    return adjustedObligations.map((item) => (
      <div key={`${item.type}-${item.period}`} className="obligation-row">
        <div className="obligation-header">
          <span className="obligation-type">{item.type}</span>
          <span className="obligation-period">{item.period}</span>
        </div>
        <div className="obligation-details">
          <span>Due {new Date(item.dueDate).toLocaleDateString("en-AU")}</span>
          <span className="obligation-amount">{currency(item.forecastCents)}</span>
        </div>
        <div className="obligation-band">
          <span>P50 {currency(item.band.p50)}</span>
          <span>P80 {currency(item.band.p80)}</span>
          <span>P90 {currency(item.band.p90)}</span>
        </div>
      </div>
    ));
  }, [adjustedObligations]);

  return (
    <div className="obligations-layout">
      <header>
        <h1>Upcoming Obligations</h1>
        <p>Monitor BAS and PAYGW lodgements alongside forecast confidence bands.</p>
      </header>
      <section className="controls">
        <label>
          Simulate growth: <strong>{growth}%</strong>
          <input
            type="range"
            min={-20}
            max={40}
            step={1}
            value={growth}
            onChange={(event) => setGrowth(Number(event.target.value))}
          />
        </label>
        <label>
          Alert threshold ($)
          <input
            type="number"
            min={0}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
          />
        </label>
        <label className="alert-toggle">
          <input type="checkbox" checked={alertEnabled} onChange={handleToggleAlert} />
          Enable cash alerts
        </label>
      </section>
      {loading && <p className="status">Loading obligations…</p>}
      {error && <p className="status error">{error}</p>}
      <section className="calendar">{calendarRows}</section>
      {data && (
        <footer>
          <p>
            Cash on hand: <strong>{currency(data.cashOnHandCents)}</strong>
          </p>
        </footer>
      )}
      <style>{`
        .obligations-layout {
          font-family: Arial, sans-serif;
          max-width: 720px;
          margin: 0 auto;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        header h1 {
          margin: 0 0 0.25rem 0;
        }
        .controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          align-items: center;
        }
        .controls input[type="range"] {
          width: 100%;
        }
        .calendar {
          display: grid;
          gap: 1rem;
        }
        .obligation-row {
          border: 1px solid #d0d5dd;
          border-radius: 12px;
          padding: 1rem;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .obligation-header {
          display: flex;
          justify-content: space-between;
          font-weight: 600;
        }
        .obligation-details {
          display: flex;
          justify-content: space-between;
          color: #475467;
        }
        .obligation-band {
          display: flex;
          gap: 1rem;
          font-size: 0.9rem;
          color: #1d4ed8;
        }
        .obligation-amount {
          font-weight: 700;
          color: #0f172a;
        }
        .status {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          background: #eff6ff;
          color: #1d4ed8;
        }
        .status.error {
          background: #fee2e2;
          color: #b91c1c;
        }
        footer {
          text-align: right;
          color: #334155;
        }
      `}</style>
    </div>
  );
};

