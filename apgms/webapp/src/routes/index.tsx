import { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../lib/api';

type Kpi = {
  id: string;
  label: string;
  value: number;
  delta?: number;
};

type DashboardSeriesPoint = {
  date: string;
  value: number;
};

type DashboardResponse = {
  kpis: Kpi[];
  series: DashboardSeriesPoint[];
};

type DashboardStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

type SeriesBucket = {
  dateLabel: string;
  value: number;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export default function Dashboard(): JSX.Element {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [status, setStatus] = useState<DashboardStatus>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchJson<DashboardResponse>('/dashboard')
      .then((response) => {
        if (cancelled) return;
        if (!response.kpis?.length && !response.series?.length) {
          setStatus('empty');
          setData(null);
          return;
        }
        setData(response);
        setStatus('success');
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const seriesBuckets = useMemo<SeriesBucket[]>(() => {
    if (!data?.series?.length) return [];
    return data.series.map((point) => ({
      dateLabel: formatDateLabel(point.date),
      value: point.value,
    }));
  }, [data]);

  if (status === 'loading') {
    return (
      <section aria-busy="true" aria-live="polite" className="dashboard dashboard--loading">
        <header className="dashboard__header">
          <h1>Dashboard</h1>
          <p>Loading financial performance…</p>
        </header>
        <div className="dashboard__kpis">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="dashboard__kpi dashboard__kpi--skeleton" />
          ))}
        </div>
        <div className="dashboard__series dashboard__series--skeleton" />
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section role="alert" className="dashboard dashboard--error">
        <header className="dashboard__header">
          <h1>Dashboard</h1>
          <p>We were unable to load performance data.</p>
        </header>
        <p>{error}</p>
      </section>
    );
  }

  if (status === 'empty') {
    return (
      <section className="dashboard dashboard--empty">
        <header className="dashboard__header">
          <h1>Dashboard</h1>
          <p>No metrics available for the past 30 days.</p>
        </header>
        <p>Connect your reporting sources to view insights.</p>
      </section>
    );
  }

  return (
    <section className="dashboard" aria-live="polite">
      <header className="dashboard__header">
        <h1>Dashboard</h1>
        <p>Performance summary for the past 30 days.</p>
      </header>

      <div className="dashboard__kpis">
        {data?.kpis.map((kpi) => (
          <article key={kpi.id} className="dashboard__kpi" aria-label={kpi.label}>
            <h2>{kpi.label}</h2>
            <p className="dashboard__kpi-value">{formatNumber(kpi.value)}</p>
            {typeof kpi.delta === 'number' && (
              <p className="dashboard__kpi-delta" aria-label="30 day delta">
                {kpi.delta >= 0 ? '+' : ''}
                {formatNumber(kpi.delta)}%
              </p>
            )}
          </article>
        ))}
      </div>

      <section className="dashboard__series" aria-label="30 day trend">
        <header>
          <h2>Daily totals</h2>
        </header>
        {seriesBuckets.length > 0 ? (
          <ol className="dashboard__series-list">
            {seriesBuckets.map((bucket) => (
              <li key={bucket.dateLabel}>
                <span className="dashboard__series-date">{bucket.dateLabel}</span>
                <span className="dashboard__series-value">{formatNumber(bucket.value)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No trend data for the selected period.</p>
        )}
      </section>
    </section>
  );
}
