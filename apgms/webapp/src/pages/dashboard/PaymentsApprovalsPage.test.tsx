import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentsApprovalsPage from './PaymentsApprovalsPage';
import { useDashboardStore } from '@/state/dashboardStore';

describe('PaymentsApprovalsPage', () => {
  beforeEach(() => {
    useDashboardStore.setState({ selectedBankLineId: null, approvedPayments: [] });
  });

  it('allows toggling payment approvals locally', async () => {
    render(<PaymentsApprovalsPage />);

    await waitFor(() => expect(screen.getByText(/Cloud Services Co/i)).toBeInTheDocument());

    const approveButton = screen.getAllByRole('button', { name: /approve now/i })[0];
    await userEvent.click(approveButton);

    expect(approveButton).toHaveTextContent(/mark as pending/i);
    expect(useDashboardStore.getState().approvedPayments).toContain('pay-001');
  });
});
