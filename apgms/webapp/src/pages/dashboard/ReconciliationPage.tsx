import { useReconciliationWorkflow } from '@/api/hooks';
import type { ReconciliationTask } from '@/api/types';
import Card from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';

const toneMap: Record<ReconciliationTask['status'], 'success' | 'warning' | 'danger'> = {
  'in-progress': 'warning',
  pending: 'danger',
  completed: 'success',
};

export const ReconciliationPage = () => {
  const { data, isLoading, error } = useReconciliationWorkflow();

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading reconciliation tasks…</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-rose-600">Unable to load reconciliation workflow.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.map((task) => (
        <Card
          key={task.id}
          header={
            <div className="flex items-center justify-between">
              <span>{task.description}</span>
              <StatusPill tone={toneMap[task.status]}>{task.status}</StatusPill>
            </div>
          }
          footer={`Assigned to ${task.assignedTo} · Due ${new Date(task.dueDate).toLocaleDateString()}`}
        >
          <p className="text-sm text-slate-600">
            Monitor outstanding reconciliation actions to maintain accurate settlement reporting.
          </p>
        </Card>
      ))}
    </div>
  );
};

export default ReconciliationPage;
