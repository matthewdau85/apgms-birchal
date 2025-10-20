import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

type KpiCard = {
  label: string;
  value: number;
  description: string;
};

type CashflowPoint = {
  date: string;
  balance: number;
};

const KPI_CARDS: KpiCard[] = [
  { label: 'Operating', value: 275000, description: 'Available cash on hand' },
  { label: 'Tax Buffer', value: 82000, description: 'Reserved for upcoming tax obligations' },
  { label: 'PAYGW', value: 46000, description: 'Next 30 days wage withholding' },
  { label: 'GST', value: 39000, description: 'Projected GST liability' },
];

const CASHFLOW_POINTS: CashflowPoint[] = Array.from({ length: 30 }).map((_, index) => {
  const baseline = 240000;
  const variance = Math.sin(index / 4) * 15000 + Math.cos(index / 3) * 10000;
  const balance = Math.round(baseline + variance + index * 1200);
  const date = new Date();
  date.setDate(date.getDate() - (29 - index));
  return {
    date: date.toISOString().slice(0, 10),
    balance,
  };
});

function KpiCard({ card }: { card: KpiCard }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm" role="status">
      <p className="text-sm font-medium text-gray-500">{card.label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{CURRENCY_FORMATTER.format(card.value)}</p>
      <p className="mt-1 text-xs text-gray-500">{card.description}</p>
    </div>
  );
}

function EmptySparkline() {
  return (
    <div
      className="flex h-60 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white"
      role="img"
      aria-label="Cashflow trend data is not available"
    >
      <span className="text-sm text-gray-500">No cashflow data available</span>
    </div>
  );
}

function CashflowSparkline({ data }: { data: CashflowPoint[] }) {
  if (!data.length) {
    return <EmptySparkline />;
  }

  const ticks = useMemo(() => data.filter((_, index) => index % 5 === 0).map((point) => point.date.slice(5)), [data]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">30 day cashflow trend</h2>
      <div className="mt-4 h-48" role="img" aria-label="Line chart showing 30 day cashflow balances">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 0, right: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="cashflowGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => value.slice(5)}
              ticks={ticks}
              stroke="#9ca3af"
              fontSize={12}
            />
            <YAxis
              dataKey="balance"
              tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
              width={48}
              stroke="#9ca3af"
              fontSize={12}
            />
            <Tooltip
              formatter={(value: number) => CURRENCY_FORMATTER.format(value)}
              labelFormatter={(label) => new Date(label).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
            />
            <Area type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2} fill="url(#cashflowGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DashboardRoute() {
  return (
    <main className="space-y-8 bg-gray-50 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Monitor cash positions and upcoming obligations.</p>
      </header>
      <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CARDS.map((card) => (
          <KpiCard key={card.label} card={card} />
        ))}
      </section>
      <section>
        <CashflowSparkline data={CASHFLOW_POINTS} />
      </section>
    </main>
  );
}
