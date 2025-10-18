import { useBankLines } from '@/api/hooks';
import type { BankLine } from '@/api/types';
import { DataTable } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { useDashboardStore } from '@/state/dashboardStore';

const toneMap: Record<BankLine['status'], 'success' | 'warning' | 'danger'> = {
  healthy: 'success',
  warning: 'warning',
  attention: 'danger',
};

export const BankLinesPage = () => {
  const { data, isLoading, error } = useBankLines();
  const { selectedBankLineId, selectBankLine } = useDashboardStore((state) => ({
    selectedBankLineId: state.selectedBankLineId,
    selectBankLine: state.selectBankLine,
  }));

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading bank lines…</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-rose-600">Unable to load bank line data.</p>;
  }

  const columns = [
    {
      header: 'Account',
      cell: (line: BankLine) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900">{line.accountName}</span>
          <span className="text-xs text-slate-500">Last updated {new Date(line.lastUpdated).toLocaleTimeString()}</span>
        </div>
      ),
    },
    {
      header: 'Balance',
      cell: (line: BankLine) => (
        <span className="font-mono text-slate-900">
          {line.currency} {line.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (line: BankLine) => <StatusPill tone={toneMap[line.status]}>{line.status}</StatusPill>,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Track bank line balances and quickly identify accounts requiring intervention.
      </p>
      <DataTable
        data={data}
        columns={columns}
        getRowKey={(line) => line.id}
        emptyState="No bank lines configured."
        onRowClick={(line) => selectBankLine(line.id)}
      />
      {selectedBankLineId ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Selected bank line: {data.find((line) => line.id === selectedBankLineId)?.accountName}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
          Click a row to focus on a particular bank line.
        </div>
      )}
    </div>
  );
};

export default BankLinesPage;
