import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DashboardKpis = {
  operating?: number | null;
  taxBuffer?: number | null;
  paygw?: number | null;
  gst?: number | null;
};

type DashboardChartPoint = {
  date: string;
  value?: number | null;
  amount?: number | null;
};

type DashboardResponse = {
  kpis?: DashboardKpis | null;
  chart?: DashboardChartPoint[] | null;
};

type ChartTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number | string }>;
};

const KPI_LABELS: Array<{ key: keyof DashboardKpis; label: string }> = [
  { key: "operating", label: "Operating" },
  { key: "taxBuffer", label: "Tax Buffer" },
  { key: "paygw", label: "PAYGW" },
  { key: "gst", label: "GST" },
];

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 2,
});

const Money: React.FC<{ value?: number | null }> = ({ value }) => {
  if (value == null || Number.isNaN(value)) {
    return <span className="money money--empty">—</span>;
  }

  const formatted = CURRENCY_FORMATTER.format(value);

  return (
    <span className="money" aria-label={formatted} data-testid="money-value">
      {formatted}
    </span>
  );
};

const SkeletonCard: React.FC = () => (
  <div className="dashboard__card dashboard__card--skeleton" aria-hidden>
    <div className="dashboard__card-title skeleton" />
    <div className="dashboard__card-value skeleton" />
  </div>
);

const ChartSkeleton: React.FC = () => (
  <div className="dashboard__chart dashboard__chart--skeleton" aria-hidden>
    <div className="dashboard__chart-canvas skeleton" />
  </div>
);

const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const rawValue = payload[0]?.value;
  const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);

  return (
    <div className="dashboard__tooltip">
      <div className="dashboard__tooltip-label">{label}</div>
      <div className="dashboard__tooltip-value">
        <Money value={Number.isNaN(numericValue) ? null : numericValue} />
      </div>
    </div>
  );
};

async function getDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  const response = await fetch("/dashboard", { signal });

  if (!response.ok) {
    throw new Error("Failed to load dashboard");
  }

  return (await response.json()) as DashboardResponse;
}

const DashboardRoute: React.FC = () => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const runDashboardRequest = useCallback((controller: AbortController) => {
    if (requestRef.current) {
      requestRef.current.abort();
    }

    requestRef.current = controller;

    setLoading(true);
    setError(null);

    getDashboard(controller.signal)
      .then((result) => {
        setData(result);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setError(err);
        }
      })
      .finally(() => {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    runDashboardRequest(controller);

    return () => {
      controller.abort();
      if (requestRef.current) {
        requestRef.current.abort();
      }
    };
  }, [runDashboardRequest]);

  const handleRetry = useCallback(() => {
    runDashboardRequest(new AbortController());
  }, [runDashboardRequest]);

  const chartData = useMemo(() => {
    if (!data?.chart || data.chart.length === 0) {
      return [] as Array<{ date: string; value: number }>;
    }

    return data.chart.map((point) => ({
      date: point.date,
      value: typeof point.value === "number" && !Number.isNaN(point.value)
        ? point.value
        : typeof point.amount === "number" && !Number.isNaN(point.amount)
        ? point.amount
        : 0,
    }));
  }, [data]);

  const hasKpis = useMemo(() => {
    if (!data?.kpis) {
      return false;
    }

    return KPI_LABELS.some(({ key }) => {
      const value = data.kpis?.[key];
      return typeof value === "number" && !Number.isNaN(value);
    });
  }, [data]);

  const showEmpty = !loading && !error && !hasKpis && chartData.length === 0;

  return (
    <section className="dashboard" aria-busy={loading} aria-live="polite">
      <header className="dashboard__header">
        <h1>Dashboard</h1>
      </header>

      {error && (
        <div className="dashboard__alert" role="alert">
          <span>Something went wrong while loading the dashboard.</span>
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <>
          <div className="dashboard__grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={`skeleton-${index}`} />
            ))}
          </div>
          <ChartSkeleton />
        </>
      )}

      {showEmpty && <p className="dashboard__empty">No data yet</p>}

      {!loading && !showEmpty && (
        <>
          <div className="dashboard__grid">
            {KPI_LABELS.map(({ key, label }) => (
              <div className="dashboard__card" key={key}>
                <div className="dashboard__card-title">{label}</div>
                <div className="dashboard__card-value">
                  <Money value={data?.kpis?.[key] ?? null} />
                </div>
              </div>
            ))}
          </div>

          <div className="dashboard__chart">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => CURRENCY_FORMATTER.format(value)} width={120} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="value" stroke="#1b78ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
};

export default DashboardRoute;

