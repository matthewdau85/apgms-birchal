import { usePaymentsApprovals } from '@/api/hooks';
import type { PaymentApproval } from '@/api/types';
import Card from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';
import Button from '@/components/ui/Button';
import { useDashboardStore } from '@/state/dashboardStore';

const toneMap: Record<PaymentApproval['status'], 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
};

export const PaymentsApprovalsPage = () => {
  const { data, isLoading, error } = usePaymentsApprovals();
  const { approvedPayments, togglePaymentApproval } = useDashboardStore((state) => ({
    approvedPayments: state.approvedPayments,
    togglePaymentApproval: state.togglePaymentApproval,
  }));

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading payment approvals…</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-rose-600">Unable to load payment approvals.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.map((approval) => {
        const isLocallyApproved = approvedPayments.includes(approval.id);
        return (
          <Card
            key={approval.id}
            header={
              <div className="flex items-center justify-between">
                <span>{approval.vendor}</span>
                <StatusPill tone={toneMap[approval.status]}>{approval.status}</StatusPill>
              </div>
            }
            footer={`Submitted ${new Date(approval.submittedAt).toLocaleString()} · Approver ${approval.approver}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {approval.currency} {approval.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-500">Review and approve this payment before settlement.</p>
              </div>
              <Button
                variant={isLocallyApproved ? 'secondary' : 'primary'}
                onClick={() => togglePaymentApproval(approval.id)}
              >
                {isLocallyApproved ? 'Mark as pending' : 'Approve now'}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default PaymentsApprovalsPage;
