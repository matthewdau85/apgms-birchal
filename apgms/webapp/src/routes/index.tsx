import { useEffect, useMemo, useState } from "react";
import { api, DashboardResponse } from "../lib/api";
import { Money } from "../ui/Money";
import { DateText } from "../ui/DateText";

type LoadState = "idle" | "loading" | "error" | "success";

const KPI_LABELS: Array<{ key: keyof DashboardResponse["summary"]; label: string; description: string }> = [
  { key: "totalDeposits", label: "Total Deposits", description: "Funds received in the last 30 days" },
  { key: "totalWithdrawals", label: "Total Withdrawals", description: "Funds paid out in the last 30 days" },
  { key: "netCash", label: "Net Cash", description: "Closing cash position" },
  { key: "openCases", label: "Open Cases", description: "Outstanding investigations" },
];

export default function DashboardRoute() {
  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      setError(null);
      try {
        const response = await api.dashboard();
        if (!cancelled) {
          setData(response);
          setState("success");
        }
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const chartPoints = useMemo(() => {
    const daily = data?.dailyBalances ?? [];
    if (!daily.length) {
      return [] as Array<{ x: number; y: number; date: string; value: number }>;
    }

    const values = daily.map((point) => point.balance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return daily.map((point, index) => ({
      x: daily.length === 1 ? 0 : (index / (daily.length - 1)) * 100,
      y: 100 - ((point.balance - min) / range) * 100,
      date: point.date,
      value: point.balance,
    }));
  }, [data?.dailyBalances]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <section aria-live="polite" aria-busy={state === "loading"}>
        <header style={{ marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Cash overview</h2>
          <p style={{ margin: "0.25rem 0 0", color: "#475569" }}>Key metrics for the last 30 days</p>
        </header>
        {state === "error" && (
          <div role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
            {error ?? "Unable to load dashboard"}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
          }}
        >
          {KPI_LABELS.map((kpi) => {
            const value = data?.summary?.[kpi.key];
            const isMoney = kpi.key !== "openCases";
            return (
              <article
                key={kpi.key}
                style={{
                  borderRadius: "0.75rem",
                  border: "1px solid rgba(148, 163, 184, 0.4)",
                  padding: "1rem",
                  background: "rgba(148, 163, 184, 0.08)",
                }}
                aria-label={kpi.label}
              >
                <h3 style={{ margin: 0, fontSize: "1rem" }}>{kpi.label}</h3>
                <p style={{ margin: "0.25rem 0", color: "#64748b", fontSize: "0.875rem" }}>{kpi.description}</p>
                {isMoney ? (
                  <Money value={typeof value === "number" ? value : null} style={{ fontSize: "1.5rem", fontWeight: 700 }} />
                ) : (
                  <span style={{ fontSize: "1.5rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {typeof value === "number" ? value : "—"}
                  </span>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section>
        <header style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>30 day balance trend</h2>
            <p style={{ margin: "0.25rem 0 0", color: "#475569" }}>Daily reconciliation snapshot</p>
          </div>
          {data?.dailyBalances?.length ? (
            <DateText
              value={data.dailyBalances[data.dailyBalances.length - 1].date}
              style={{ color: "#64748b", fontSize: "0.875rem" }}
            />
          ) : null}
        </header>
        {chartPoints.length === 0 ? (
          <div
            role="status"
            style={{
              padding: "2rem",
              border: "1px dashed rgba(148, 163, 184, 0.6)",
              borderRadius: "0.75rem",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            No balance history available yet.
          </div>
        ) : (
          <figure
            style={{
              border: "1px solid rgba(148, 163, 184, 0.4)",
              borderRadius: "0.75rem",
              padding: "1rem",
              background: "rgba(15, 23, 42, 0.04)",
            }}
          >
            <svg viewBox="0 0 100 100" role="img" aria-label="30 day balance chart" style={{ width: "100%", height: "240px" }}>
              <polyline
                fill="rgba(14, 165, 233, 0.25)"
                stroke="rgba(14, 165, 233, 0.9)"
                strokeWidth={1.5}
                points={chartPoints
                  .map((point, index) => {
                    const coords = `${point.x},${point.y}`;
                    if (index === 0) {
                      return `0,100 ${coords}`;
                    }
                    if (index === chartPoints.length - 1) {
                      return `${coords} 100,100`;
                    }
                    return coords;
                  })
                  .join(" ")}
              />
            </svg>
            <figcaption style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
              Showing balances for the last {chartPoints.length} days.
            </figcaption>
          </figure>
        )}
      </section>
    </div>
  );
}
