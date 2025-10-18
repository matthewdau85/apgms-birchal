import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type MoneyProps = {
  value: number | null | undefined;
};

type DashboardResponse = {
  kpis: {
    operating: number | null;
    taxBuffer: number | null;
    paygw: number | null;
    gst: number | null;
  };
  trend: Array<{
    date: string;
    value: number;
  }>;
};

type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'success'; data: DashboardResponse };

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: Math.abs(value) < 1 ? 2 : 0,
  }).format(value);

const Money = ({ value }: MoneyProps) => {
  if (value === null || value === undefined) {
    return <span style={{ opacity: 0.5 }}>—</span>;
  }

  return <span>{formatCurrency(value)}</span>;
};

const KPI_LABELS: Array<{ key: keyof DashboardResponse['kpis']; label: string }> = [
  { key: 'operating', label: 'Operating' },
  { key: 'taxBuffer', label: 'Tax Buffer' },
  { key: 'paygw', label: 'PAYGW' },
  { key: 'gst', label: 'GST' },
];

async function getDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  const response = await fetch('/dashboard', { signal });

  if (!response.ok) {
    throw new Error('Unable to load dashboard');
  }

  return response.json();
}

const CardSkeleton = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '16px',
      borderRadius: '12px',
      background: '#f5f5f5',
      minHeight: '120px',
    }}
  >
    <div
      style={{
        height: '16px',
        width: '40%',
        borderRadius: '999px',
        background: 'linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
    <div
      style={{
        height: '32px',
        width: '70%',
        borderRadius: '12px',
        background: 'linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  </div>
);

const ChartSkeleton = () => (
  <div
    style={{
      height: '260px',
      borderRadius: '16px',
      background: 'linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }}
  />
);

const EmptyState = () => (
  <div
    style={{
      border: '1px dashed #d0d0d0',
      borderRadius: '16px',
      padding: '32px',
      textAlign: 'center',
      color: '#6b7280',
      backgroundColor: '#fafafa',
    }}
  >
    <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No data yet</div>
    <div>Connect your accounts to see 30-day performance data.</div>
  </div>
);

const Alert = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: '12px',
      padding: '16px 20px',
      backgroundColor: '#fef2f2',
      color: '#b91c1c',
      border: '1px solid #fecaca',
      gap: '16px',
    }}
  >
    <span>{message}</span>
    <button
      type="button"
      onClick={onRetry}
      style={{
        borderRadius: '8px',
        border: '1px solid #ef4444',
        backgroundColor: '#ffffff',
        color: '#ef4444',
        padding: '6px 12px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Retry
    </button>
  </div>
);

const ChartContainer = ({ data }: { data: DashboardResponse['trend'] }) => {
  if (!data.length) {
    return <EmptyState />;
  }

  return (
    <div
      style={{
        height: '280px',
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 20, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#f3f4f6" strokeDasharray="4 8" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            style={{ fontSize: '12px', color: '#6b7280' }}
            minTickGap={24}
          />
          <YAxis
            width={80}
            tickFormatter={(value: number) => formatCurrency(value).replace('A$\xa0', '$ ')}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
            style={{ fontSize: '12px', color: '#6b7280' }}
          />
          <Tooltip
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
            labelStyle={{ fontWeight: 600 }}
            formatter={(value: number) => formatCurrency(value)}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const KPICard = ({ label, value }: { label: string; value: number | null | undefined }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      backgroundColor: '#ffffff',
      minHeight: '120px',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    }}
  >
    <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>
      <Money value={value} />
    </span>
  </div>
);

const isDashboardEmpty = (data: DashboardResponse) => {
  const hasTrend = data.trend.some((point) => point.value !== 0);
  const hasKpi = Object.values(data.kpis).some((value) => (value ?? 0) !== 0);
  return !hasTrend && !hasKpi;
};

export default function DashboardRoute() {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setState({ status: 'loading' });

    getDashboard(controller.signal)
      .then((payload) => {
        if (isDashboardEmpty(payload)) {
          setState({ status: 'empty' });
        } else {
          setState({ status: 'success', data: payload });
        }
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Something went wrong. Please try again.';
        setState({ status: 'error', message });
      });

    return () => controller.abort();
  }, [reloadToken]);

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const content = useMemo(() => {
    if (state.status === 'loading') {
      return (
        <>
          <div style={styles.grid}>
            {KPI_LABELS.map((item) => (
              <CardSkeleton key={item.key} />
            ))}
          </div>
          <ChartSkeleton />
        </>
      );
    }

    if (state.status === 'error') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Alert message={state.message} onRetry={retry} />
          <ChartSkeleton />
        </div>
      );
    }

    if (state.status === 'empty') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={styles.grid}>
            {KPI_LABELS.map((item) => (
              <KPICard key={item.key} label={item.label} value={0} />
            ))}
          </div>
          <EmptyState />
        </div>
      );
    }

    const data = state.data;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={styles.grid}>
          {KPI_LABELS.map((item) => (
            <KPICard key={item.key} label={item.label} value={data.kpis[item.key]} />
          ))}
        </div>
        <ChartContainer data={data.trend} />
      </div>
    );
  }, [state, retry]);

  return (
    <div
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        backgroundColor: '#f9fafb',
        minHeight: '100%',
      }}
    >
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, color: '#111827' }}>
          Dashboard
        </h1>
        <p style={{ color: '#6b7280', marginTop: '8px', marginBottom: 0 }}>
          Key metrics and 30-day performance summary
        </p>
      </div>
      {content}
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gap: '16px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  } as const,
};
