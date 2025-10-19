import { Outlet } from '@tanstack/react-router';
import { createRootRoute } from '@tanstack/react-router';

import { AppShell } from '../shell/AppShell';

const RootComponent = () => (
  <AppShell>
    <Outlet />
  </AppShell>
);

export const Route = createRootRoute({
  component: RootComponent
});
