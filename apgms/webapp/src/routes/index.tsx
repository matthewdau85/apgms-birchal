import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { DashboardChartPoint, fetchDashboard } from '../lib/api';
import Money from '../ui/Money';
import DateText from '../ui/DateText';
import Skeleton from '../ui/Skeleton';

const CHART_HEIGHT = 240;
const CHART_WIDTH = 720;

function DashboardRoute(): JSX.Element {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 30_000
  });

  const kpis = data?.kpis ?? [];
  const chartPoints = data?.chart ?? [];

  const { path, area, labels, minValue, maxValue } = useMemo(() => buildChart(chartPoints), [chartPoints]);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Key performance indicators and trailing 30 day facility utilisation.
        </p>
        {data?.lastUpdated && (
          <DateText value={data.lastUpdated} className="block" options={{ dateStyle: 'medium', timeStyle: 'short' }} />
        )}
      </section>

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {error instanceof Error ? error.message : 'We were unable to load dashboard data.'}
        </div>
      )}

      <section aria-live="polite" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading &&
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}
        {!isLoading &&
          (kpis.length > 0 ? (
            kpis.map((kpi) => (
              <article
                key={kpi.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
                aria-label={`${kpi.label} metric`}
              >
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <p className="mt-2 text-2xl font-semibold">
                  <Money value={kpi.value} currency={kpi.currency} />
                </p>
                {typeof kpi.delta === 'number' && (
                  <p
                    className={`mt-2 text-sm font-medium ${
                      kpi.delta > 0 ? 'text-success' : kpi.delta < 0 ? 'text-danger' : 'text-muted-foreground'
                    }`}
                  >
                    {kpi.delta > 0 ? '▲' : kpi.delta < 0 ? '▼' : '—'}
                    <span className="ml-1">{Math.abs(kpi.delta).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</span>
                    {kpi.deltaLabel ? <span className="ml-1 text-muted-foreground">{kpi.deltaLabel}</span> : null}
                  </p>
                )}
              </article>
            ))
          ) : (
            <p className="col-span-full rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No KPI data is available yet.
            </p>
          ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">30 day utilisation</h2>
            <p className="text-sm text-muted-foreground">Rolling sum of drawn balance across your facilities.</p>
          </div>
          {chartPoints.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Range {minValue.toLocaleString()} — {maxValue.toLocaleString()}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : chartPoints.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No chart data for this period.</p>
          ) : (
            <figure>
              <svg
                role="img"
                aria-labelledby="utilisation-title utilisation-desc"
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="h-60 w-full"
              >
                <title id="utilisation-title">Facility utilisation over time</title>
                <desc id="utilisation-desc">A line chart showing the trailing 30 day utilisation.</desc>
                <path d={area} fill="hsl(var(--primary) / 0.1)" />
                <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth={3} strokeLinecap="round" />
                {labels.map((label) => (
                  <g key={label.date}>
                    <circle cx={label.x} cy={label.y} r={4} fill="hsl(var(--primary))" />
                    <title>
                      {label.dateLabel}: {label.valueLabel}
                    </title>
                  </g>
                ))}
              </svg>
              <figcaption className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                {labels.map((label) => (
                  <div key={label.date} className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    <span className="tabular-nums">{label.dateLabel}</span>
                    <span className="tabular-nums font-medium text-card-foreground">{label.valueLabel}</span>
                  </div>
                ))}
              </figcaption>
            </figure>
          )}
        </div>
      </section>
    </div>
  );
}

function buildChart(points: DashboardChartPoint[]) {
  if (points.length === 0) {
    return {
      path: '',
      area: '',
      labels: [] as Array<{ date: string; dateLabel: string; valueLabel: string; x: number; y: number }>,
      minValue: 0,
      maxValue: 0
    };
  }

  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const step = points.length > 1 ? CHART_WIDTH / (points.length - 1) : CHART_WIDTH;

  const pathPoints = points.map((point, index) => {
    const x = index * step;
    const y = CHART_HEIGHT - ((point.value - minValue) / range) * (CHART_HEIGHT - 24) - 12;
    return { x, y, point };
  });

  const path = pathPoints
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');

  const area = `${path} L${pathPoints[pathPoints.length - 1]?.x.toFixed(2) ?? CHART_WIDTH} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z`;

  const labelFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const valueFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

  const keyPoints = [0, Math.floor(points.length / 2), points.length - 1]
    .filter((index, position, array) => array.indexOf(index) === position)
    .map((index) => pathPoints[index])
    .filter((item): item is (typeof pathPoints)[number] => Boolean(item));

  const labels = keyPoints.map(({ point, x, y }) => ({
    date: point.date,
    dateLabel: labelFormatter.format(new Date(point.date)),
    valueLabel: valueFormatter.format(point.value),
    x,
    y
  }));

  return { path, area, labels, minValue, maxValue };
}

export default DashboardRoute;
