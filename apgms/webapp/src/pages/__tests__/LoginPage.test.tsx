import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { renderWithRouter } from '../../test-utils';
import { useAppStore, createInitialState } from '../../store/appStore';
import { LoginPage } from '../LoginPage';

describe('LoginPage', () => {
  beforeEach(() => {
    useAppStore.setState(() => ({
      ...createInitialState(),
      signIn: useAppStore.getState().signIn,
      isAuthenticated: () => false
    }));
  });

  it('validates required fields before submitting', async () => {
    renderWithRouter(<LoginPage />, { initialEntries: ['/login'] });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/enter both your email address/i)).toBeVisible();
  });

  it('calls signIn with entered credentials', async () => {
    const signInSpy = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState((state) => ({
      ...state,
      signIn: signInSpy,
      isBootstrapping: false,
      isAuthenticated: () => false
    }));

    renderWithRouter(<LoginPage />, { initialEntries: ['/login'] });

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'user@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });

    fireEvent.submit(screen.getByRole('form', { name: /sign in/i }));

    expect(signInSpy).toHaveBeenCalledWith('user@example.com', 'password123');
  });
});
