import type { QueryClient } from '@tanstack/react-query';
import { createRouter, type History } from '@tanstack/react-router';

import { Route as rootRoute } from './routes/__root';
import { Route as dashboardRoute } from './routes/index';
import { Route as bankLinesRoute } from './routes/bank-lines';

export type AppRouterContext = {
  queryClient: QueryClient;
};

const routeTree = rootRoute.addChildren([dashboardRoute, bankLinesRoute]);

export const createAppRouter = (
  queryClient: QueryClient,
  options?: { history?: History }
) =>
  createRouter<AppRouterContext>({
    routeTree,
    context: { queryClient },
    history: options?.history,
    defaultPreload: 'intent'
  });

export { routeTree };
