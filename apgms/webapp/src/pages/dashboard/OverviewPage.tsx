import Card from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';
import { useDashboardSummary } from '@/api/hooks';

const summaryLabels: Record<string, { label: string; tone: 'info' | 'warning' | 'success' | 'danger' }> = {
  bankLinesCount: { label: 'Bank lines monitored', tone: 'info' },
  reconciliationsInProgress: { label: 'Reconciliations in progress', tone: 'warning' },
  pendingApprovals: { label: 'Payments awaiting approval', tone: 'danger' },
  lodgementsDue: { label: 'ATO lodgements due', tone: 'warning' },
};

export const OverviewPage = () => {
  const { data, isLoading, error } = useDashboardSummary();

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading summary…</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-rose-600">Unable to load dashboard summary.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Object.entries(summaryLabels).map(([key, meta]) => (
        <Card key={key} header={meta.label} className="bg-gradient-to-br from-white via-white to-slate-50">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-semibold text-slate-900">{(data as Record<string, number>)[key]}</span>
            <StatusPill tone={meta.tone}>{meta.label.split(' ')[0]}</StatusPill>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default OverviewPage;
