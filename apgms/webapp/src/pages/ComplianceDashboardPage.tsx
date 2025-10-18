import { DataCard } from '../components/ui/DataCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TrendPill } from '../components/ui/TrendPill';
import { useAppStore } from '../store/appStore';

const severityTone = {
  low: 'default',
  medium: 'warning',
  high: 'danger'
} as const;

export const ComplianceDashboardPage = () => {
  const { complianceMetrics, complianceNotices, acknowledgeNotice } = useAppStore((state) => ({
    complianceMetrics: state.complianceMetrics,
    complianceNotices: state.complianceNotices,
    acknowledgeNotice: state.acknowledgeNotice
  }));

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1>Compliance overview</h1>
          <p>
            Understand current filing health and address outstanding notices before they become
            blockers.
          </p>
        </div>
      </header>

      <div className="grid">
        {complianceMetrics.map((metric) => (
          <DataCard
            key={metric.id}
            title={metric.label}
            action={<TrendPill trend={metric.trend} />}
          >
            <p className="metric-value">{metric.value}</p>
          </DataCard>
        ))}
      </div>

      <section className="panel">
        <header className="panel__header">
          <h2>Open notices</h2>
        </header>
        {complianceNotices.length === 0 ? (
          <p>You're fully compliant — no open notices.</p>
        ) : (
          <ul className="notice-list">
            {complianceNotices.map((notice) => (
              <li key={notice.id} className="notice-list__item">
                <div>
                  <h3>{notice.title}</h3>
                  <p>{notice.description}</p>
                </div>
                <div className="notice-list__meta">
                  <StatusBadge
                    label={notice.severity.toUpperCase()}
                    tone={severityTone[notice.severity] as 'default' | 'warning' | 'danger'}
                  />
                  <button
                    className="button button--ghost"
                    type="button"
                    disabled={notice.acknowledged}
                    onClick={() => acknowledgeNotice(notice.id)}
                  >
                    {notice.acknowledged ? 'Acknowledged' : 'Acknowledge'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
