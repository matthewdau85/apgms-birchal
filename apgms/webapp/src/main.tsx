import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  RootRoute,
  Route,
  createRouter,
} from '@tanstack/react-router';

import AppShell, { ThemeProvider } from './shell/AppShell';

const queryClient = new QueryClient();

const rootRoute = new RootRoute({
  component: AppShell,
});

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const bankLinesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: 'bank-lines',
  component: BankLinesPage,
});

const routeTree = rootRoute.addChildren([dashboardRoute, bankLinesRoute]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function DashboardPage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Review organisation insights and trends.
        </p>
      </header>
      <div className="grid gap-4 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
        Connect data sources to populate this dashboard.
      </div>
    </section>
  );
}

function BankLinesPage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bank Lines</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Track utilisation, covenants, and reporting for each facility.
        </p>
      </header>
      <div className="grid gap-4 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
        Select a facility to view available reports.
      </div>
    </section>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
