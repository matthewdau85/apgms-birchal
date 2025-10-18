import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import AppShell from './shell/AppShell';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'apgms:theme';

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

const getPreferredTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage?.getItem(THEME_STORAGE_KEY);
  if (isTheme(stored)) {
    return stored;
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
};

const applyTheme = (theme: Theme) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.setAttribute('data-theme', theme);
};

const initialTheme = getPreferredTheme();
applyTheme(initialTheme);

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell initialTheme={initialTheme} storageKey={THEME_STORAGE_KEY} />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'bank-lines', element: <BankLinesPage /> },
    ],
  },
]);

function DashboardPage() {
  return (
    <section aria-labelledby="dashboard-heading" style={{ padding: '1.5rem' }}>
      <h1 id="dashboard-heading" style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
        Dashboard
      </h1>
      <p style={{ lineHeight: 1.6, maxWidth: '38rem' }}>
        Welcome to the APGMS console. Use the navigation to explore operational insights and
        financial overviews tailored for your organisation.
      </p>
    </section>
  );
}

function BankLinesPage() {
  return (
    <section aria-labelledby="bank-lines-heading" style={{ padding: '1.5rem' }}>
      <h1 id="bank-lines-heading" style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
        Bank Lines
      </h1>
      <p style={{ lineHeight: 1.6, maxWidth: '38rem' }}>
        Review the facilities that power your bank lines. Filter and drill into each line to monitor
        utilisation, repayments, and upcoming maturities.
      </p>
    </section>
  );
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element with id "root" was not found.');
}

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
