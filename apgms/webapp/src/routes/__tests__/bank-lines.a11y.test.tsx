import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BankLines from '../bank-lines';
import { fetchJson } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  fetchJson: vi.fn((path: string) => {
    if (path === '/bank-lines') {
      return Promise.resolve([
        { id: '1', date: '2024-02-01T00:00:00.000Z', payee: 'Delta Corp', amount: 1200.5 },
        { id: '2', date: '2024-02-02T00:00:00.000Z', payee: 'Alpha LLC', amount: 320.89 },
      ]);
    }

    if (path.startsWith('/audit/rpt/by-line/')) {
      return Promise.resolve({ verified: true, timestamp: '2024-02-10T12:34:56.000Z' });
    }

    return Promise.reject(new Error(`Unhandled path: ${path}`));
  }),
}));

type FetchJsonMock = vi.Mock;
const fetchJsonMock = fetchJson as unknown as FetchJsonMock;

describe('BankLines accessibility behaviours', () => {
  beforeEach(() => {
    fetchJsonMock.mockClear();
  });

  it('traps focus inside the drawer and closes with Escape', async () => {
    const user = userEvent.setup();
    render(<BankLines />);

    const openButtons = await screen.findAllByRole('button', { name: /view .* details/i });
    await user.click(openButtons[0]);

    const dialog = await screen.findByRole('dialog');
    const buttons = within(dialog).getAllByRole('button');

    expect(document.activeElement).toBe(buttons[0]);

    await user.tab();
    expect(document.activeElement).toBe(buttons[1]);

    await user.tab();
    expect(document.activeElement).toBe(buttons[0]);

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('is free of axe violations when the drawer is open', async () => {
    const user = userEvent.setup();
    const { container } = render(<BankLines />);

    const openButtons = await screen.findAllByRole('button', { name: /view .* details/i });
    await user.click(openButtons[0]);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
