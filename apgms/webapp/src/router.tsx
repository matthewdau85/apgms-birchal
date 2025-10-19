import { createRouter, RootRoute, Route, Router } from '@tanstack/react-router';
import { AppShell } from './shell/AppShell';
import DashboardRoute from './routes';
import BankLinesRoute from './routes/bank-lines';
import PoliciesRoute from './routes/policies';
import GatesRoute from './routes/gates';
import AuditRoute from './routes/audit';
import { ErrorState } from './ui/Error';

const rootRoute = new RootRoute({
  component: AppShell,
  errorComponent: ({ error }) => (
    <div className="p-6">
      <ErrorState>{error instanceof Error ? error.message : 'Something went wrong'}</ErrorState>
    </div>
  ),
});

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardRoute,
  errorComponent: ({ error }) => (
    <div className="p-6">
      <ErrorState>{error instanceof Error ? error.message : 'Unable to load dashboard.'}</ErrorState>
    </div>
  ),
});

const bankLinesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/bank-lines',
  component: BankLinesRoute,
  errorComponent: ({ error }) => (
    <div className="p-6">
      <ErrorState>{error instanceof Error ? error.message : 'Unable to load bank lines.'}</ErrorState>
    </div>
  ),
});

const policiesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/policies',
  component: PoliciesRoute,
  errorComponent: ({ error }) => (
    <div className="p-6">
      <ErrorState>{error instanceof Error ? error.message : 'Unable to load policies.'}</ErrorState>
    </div>
  ),
});

const gatesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/gates',
  component: GatesRoute,
  errorComponent: ({ error }) => (
    <div className="p-6">
      <ErrorState>{error instanceof Error ? error.message : 'Unable to load gates.'}</ErrorState>
    </div>
  ),
});

const auditRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/audit',
  component: AuditRoute,
  errorComponent: ({ error }) => (
    <div className="p-6">
      <ErrorState>{error instanceof Error ? error.message : 'Unable to load audit view.'}</ErrorState>
    </div>
  ),
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  bankLinesRoute,
  policiesRoute,
  gatesRoute,
  auditRoute,
]);

export const router: Router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
