import { useMemo } from 'react';
import { useDashboard } from '../lib/hooks';
import { Money } from '../ui/Money';
import { Skeleton } from '../ui/Skeleton';
import { Empty } from '../ui/Empty';
import { ErrorState } from '../ui/Error';
import { DateTime } from '../ui/DateTime';

const MetricCard = ({
  label,
  value,
  change30d,
}: {
  label: string;
  value: number;
  change30d?: number;
}) => {
  const formattedChange = change30d !== undefined ? `${change30d > 0 ? '+' : ''}${change30d.toFixed(1)}%` : null;
  const isCurrency = /usd|exposure|volume|limit|credit|balance|outstanding/i.test(label);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {isCurrency ? <Money amount={value} /> : value.toLocaleString()}
      </p>
      {formattedChange ? (
        <p className={`mt-1 text-xs ${change30d && change30d < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
          {formattedChange} in the last 30 days
        </p>
      ) : null}
    </div>
  );
};

const VolumeChart = ({ points }: { points: Array<{ date: string; value: number }> }) => {
  if (!points.length) {
    return <Empty>We’ll show activity once transactions come in.</Empty>;
  }
  const max = Math.max(...points.map((p) => p.value), 0) || 1;
  const maxHeight = 120;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">Last 30 days volume</h2>
        <DateTime value={points[points.length - 1]?.date} variant="date" className="text-xs text-slate-400" />
      </div>
      <div className="flex items-end gap-1">
        {points.map((point) => {
          const height = Math.max((point.value / max) * maxHeight, 8);
          return (
            <div key={point.date} className="flex flex-col items-center">
              <div
                className="w-2 rounded-t bg-indigo-500/70 dark:bg-indigo-400/80"
                style={{ height }}
                role="presentation"
              />
              <span className="mt-1 hidden text-[10px] text-slate-400 sm:block">{new Date(point.date).getDate()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DashboardRoute = () => {
  const { data, isLoading, isError, refetch } = useDashboard();
  const metrics = data?.data?.metrics ?? data?.metrics ?? [];
  const points = useMemo(() => data?.data?.volumeLast30Days ?? data?.volumeLast30Days ?? [], [data]);

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <div className="lg:col-span-3">
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()}>Unable to load dashboard.</ErrorState>;
  }

  if (!metrics.length) {
    return <Empty>Dashboard metrics will appear once the first cycle completes.</Empty>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} change30d={metric.change30d} />
        ))}
      </div>
      <VolumeChart points={points} />
    </div>
  );
};

export default DashboardRoute;
