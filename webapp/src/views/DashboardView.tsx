import { useMemo, useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { KpiSummaryCard } from '../components/dashboard/KpiSummaryCard';
import { VolumeChart } from '../components/dashboard/VolumeChart';
import { BankLinesTable } from '../components/dashboard/BankLinesTable';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import styles from './DashboardView.module.css';
import { BankLine } from '../data/dashboardData';

export const DashboardView = () => {
  const { data, status, error } = useDashboardData();
  const [optimisticLines, setOptimisticLines] = useState<Record<string, BankLine['rptStatus']>>({});

  const bankLines = useMemo(() => {
    if (!data) return [];
    return data.bankLines.map((line) => ({
      ...line,
      rptStatus: optimisticLines[line.id] ?? line.rptStatus
    }));
  }, [data, optimisticLines]);

  if (status === 'loading') {
    return (
      <div className={styles.grid}>
        <section className={styles.kpiGrid} aria-label="Loading KPI summaries">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="skeleton" style={{ height: 120 }} aria-hidden />
          ))}
        </section>
        <section>
          <Card className="skeleton" style={{ height: 320 }} aria-hidden />
        </section>
        <section>
          <Card className="skeleton" style={{ height: 360 }} aria-hidden />
        </section>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="Unable to load dashboard"
        description={error?.message ?? 'Something went wrong fetching the dashboard data.'}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="No dashboard data"
        description="There is no dashboard data to display yet. Connect a data source to start tracking activity."
      />
    );
  }

  const handleVerify = async (id: string) => {
    setOptimisticLines((prev) => ({ ...prev, [id]: 'verified' }));
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  return (
    <div className={styles.grid}>
      <section className={styles.headerSection}>
        <div>
          <h1>Warehouse Dashboard</h1>
          <p className={styles.subtitle}>Monitor exposure, utilization, and reporting status in real time.</p>
        </div>
      </section>
      <section className={styles.kpiGrid} aria-label="KPI summaries">
        {data.kpis.map((kpi) => (
          <KpiSummaryCard key={kpi.label} summary={kpi} />
        ))}
      </section>
      <section>
        <VolumeChart data={data.timeSeries} />
      </section>
      <section aria-labelledby="bank-lines-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="bank-lines-heading">Bank Lines</h2>
            <p className={styles.sectionDescription}>Track availability, utilization, and reporting workflow.</p>
          </div>
        </div>
        <BankLinesTable data={bankLines} onVerify={handleVerify} />
      </section>
    </div>
  );
};
