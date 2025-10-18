import { QueryClient } from '@tanstack/react-query';
import { Outlet, RootRoute, Route, Router } from '@tanstack/react-router';
import { lazy } from 'react';
import { AppShell } from './shell/AppShell';

const DashboardRouteComponent = lazy(() => import('./routes/index'));
const BankLinesRouteComponent = lazy(() => import('./routes/bank-lines'));
const NotFoundRouteComponent = lazy(() => import('./routes/not-found'));

type AppRouterContext = {
  queryClient: QueryClient;
};

const rootRoute = new RootRoute<AppRouterContext>({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  )
});

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardRouteComponent
});

const bankLinesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/bank-lines',
  component: BankLinesRouteComponent
});

const notFoundRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '*',
  component: NotFoundRouteComponent
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  bankLinesRoute,
  notFoundRoute
]);

export type { AppRouterContext };

export function createAppRouter(context: AppRouterContext) {
  return new Router({
    routeTree,
    context
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
