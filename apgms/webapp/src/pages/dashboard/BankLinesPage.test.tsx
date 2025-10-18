import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BankLinesPage from './BankLinesPage';
import { useDashboardStore } from '@/state/dashboardStore';

describe('BankLinesPage', () => {
  beforeEach(() => {
    useDashboardStore.setState({ selectedBankLineId: null, approvedPayments: [] });
  });

  it('displays bank lines and allows selection', async () => {
    render(<BankLinesPage />);

    await waitFor(() => expect(screen.getByText(/Operating Account/i)).toBeInTheDocument());

    await userEvent.click(screen.getByText(/Operating Account/i));

    expect(
      screen.getByText(/Selected bank line: Operating Account/i)
    ).toBeInTheDocument();
    expect(useDashboardStore.getState().selectedBankLineId).toBe('bl-001');
  });
});
