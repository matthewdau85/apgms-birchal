import { Outlet } from '@tanstack/react-router';
import { createRootRouteWithContext } from '@tanstack/react-router';

import { AppShell } from '../shell/AppShell';
import type { RouterContext } from '../types/router';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
