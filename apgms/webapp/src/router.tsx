import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { type ReactNode, Suspense } from 'react';
import { AppShell } from './components/app-shell';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Dashboard } from './routes/dashboard';
import { BankLines } from './routes/bank-lines';

const queryClient = new QueryClient();

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Suspense fallback={<div className="p-6">Loading...</div>}>
        <Outlet />
      </Suspense>
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </AppShell>
  )
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard
});

const bankLinesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'bank-lines',
  component: BankLines
});

const routeTree = rootRoute.addChildren([dashboardRoute, bankLinesRoute]);

const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
