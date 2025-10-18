import { useAtoLodgementStatus } from '@/api/hooks';
import type { AtoLodgement } from '@/api/types';
import { DataTable } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';

const toneMap: Record<AtoLodgement['status'], 'success' | 'warning' | 'danger'> = {
  lodged: 'success',
  pending: 'warning',
  overdue: 'danger',
};

export const AtoLodgementPage = () => {
  const { data, isLoading, error } = useAtoLodgementStatus();

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading ATO lodgement status…</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-rose-600">Unable to load ATO lodgements.</p>;
  }

  const columns = [
    {
      header: 'Period',
      cell: (lodgement: AtoLodgement) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900">{lodgement.period}</span>
          <span className="text-xs text-slate-500">Due {new Date(lodgement.dueDate).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (lodgement: AtoLodgement) => <StatusPill tone={toneMap[lodgement.status]}>{lodgement.status}</StatusPill>,
    },
    {
      header: 'Lodged at',
      cell: (lodgement: AtoLodgement) => (
        <span className="text-sm text-slate-600">
          {lodgement.lodgedAt ? new Date(lodgement.lodgedAt).toLocaleDateString() : 'Awaiting submission'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Keep track of BAS, PAYG and other ATO obligations to ensure nothing slips through compliance windows.
      </p>
      <DataTable
        data={data}
        columns={columns}
        getRowKey={(lodgement) => lodgement.id}
        emptyState="No ATO lodgements scheduled."
      />
    </div>
  );
};

export default AtoLodgementPage;
