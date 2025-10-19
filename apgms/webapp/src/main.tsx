import './index.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  RouterProvider,
  createRouter,
  createRoute,
  createRootRouteWithContext,
  Outlet
} from '@tanstack/react-router';
import { RouterDevtools } from '@tanstack/router-devtools';
import React, { StrictMode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { BankLinesPage } from './pages/BankLinesPage';
import { DashboardPage } from './pages/DashboardPage';
import { AppShell } from './shell/AppShell';

type RouterContext = {
  queryClient: QueryClient;
};

type ThemeContextValue = {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
};

const queryClient = new QueryClient();
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <RootLayout />
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage
});

const bankLinesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bank-lines',
  component: BankLinesPage
});

const routeTree = rootRoute.addChildren([dashboardRoute, bankLinesRoute]);

const router = createRouter({
  routeTree,
  context: { queryClient }
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function useThemeContext() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('ThemeContext unavailable');
  }
  return value;
}

function RootLayout() {
  const { theme, toggleTheme } = useThemeContext();
  return (
    <AppShell theme={theme} onToggleTheme={toggleTheme}>
      <Outlet />
    </AppShell>
  );
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <ReactQueryDevtools buttonPosition="bottom-right" initialIsOpen={false} />
        <RouterDevtools position="bottom-right" />
      </QueryClientProvider>
    </ThemeContext.Provider>
  );
}

const rootEl = document.getElementById('root');

if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
