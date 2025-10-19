import React, { useMemo } from 'react';
import Money from '../components/Money';
import { ErrorState, LoadingState } from '../components/Feedback';
import LineChart from '../components/LineChart';
import DateText from '../components/DateText';
import { getDashboard } from '../services/api';
import { useAsync } from '../hooks/useAsync';

const DashboardPage: React.FC = () => {
  const { data, loading, error, reload } = useAsync(() => getDashboard());

  const content = useMemo(() => {
    if (loading) {
      return <LoadingState message="Fetching dashboard data…" />;
    }

    if (error || !data) {
      return <ErrorState message="We could not load the dashboard." onRetry={reload} />;
    }

    return (
      <>
        <section className="dashboard-grid" aria-label="Key performance indicators">
          {data.kpis.map((kpi) => (
            <article className="card" key={kpi.id} aria-live="polite">
              <h2>{kpi.label}</h2>
              <p className="kpi-value">
                {kpi.id === 'utilisation' || kpi.id === 'overdraft' ? (
                  <>{kpi.value}%</>
                ) : (
                  <Money value={kpi.value} />
                )}
              </p>
              <p className="kpi-change" aria-label={`Change ${kpi.change}%`}>
                {kpi.change > 0 ? '▲' : '▼'} {Math.abs(kpi.change)}%
              </p>
            </article>
          ))}
        </section>
        <LineChart data={data.chart} />
      </>
    );
  }, [data, error, loading, reload]);

  return (
    <div>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Portfolio overview</h1>
        <p style={{ color: 'var(--muted)' }}>
          Updated <DateText value={new Date().toISOString()} formatOptions={{ dateStyle: 'medium' }} />
        </p>
      </header>
      {content}
    </div>
  );
};

export default DashboardPage;
