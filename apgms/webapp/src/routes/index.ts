import { createRouter } from '@tanstack/react-router';

import { bankLinesRoute } from '@/routes/bank-lines';
import { dashboardRoute } from '@/routes/dashboard';
import { rootRoute } from '@/routes/__root';

const routeTree = rootRoute.addChildren([dashboardRoute, bankLinesRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
