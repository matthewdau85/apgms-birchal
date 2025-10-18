import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';
import { useAuthStore } from '@/state/authStore';

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'idle', error: null });
  });

  it('authenticates an operator and redirects to the dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/" element={<div>dashboard home</div>} />
        </Routes>
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText(/email address/i), 'operator@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'super-secret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/dashboard home/i)).toBeInTheDocument());
    expect(useAuthStore.getState().user?.email).toBe('operator@example.com');
  });
});
