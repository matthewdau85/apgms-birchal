import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { createMemoryHistory } from '@tanstack/router-memory-history';
import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import { JSDOM } from 'jsdom';
import React from 'react';

import { createAppRouter } from '../src/router';
import { dashboardQueryOptions } from '../src/routes/index';
import { bankLinesQueryOptions } from '../src/routes/bank-lines';
import type { BankLinesResponse, DashboardResponse } from '../src/lib/api';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });

(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).navigator = dom.window.navigator;
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).Node = dom.window.Node;
(globalThis as any).MutationObserver = dom.window.MutationObserver;
(globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0);
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
(globalThis as any).matchMedia = globalThis.matchMedia ?? ((query: string) => ({
  matches: query.includes('prefers-color-scheme: dark'),
  media: query,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false
}));

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

(globalThis as any).ResizeObserver = ResizeObserver;
(globalThis as any).IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

type Scenario = {
  path: string;
  seed: (client: QueryClient) => void;
};

const dashboardSample: DashboardResponse = {
  asOf: new Date().toISOString(),
  kpis: [
    { id: 'cash', label: 'Available cash', value: 2350000, delta: 4.2, deltaDirection: 'up' },
    { id: 'rpt', label: 'Ready to pay', value: 820000, delta: -1.3, deltaDirection: 'down' },
    { id: 'payables', label: 'Payables', value: 310000, delta: 2.1, deltaDirection: 'up' },
    { id: 'receivables', label: 'Receivables', value: 920000, delta: 0.8, deltaDirection: 'up' }
  ],
  cashTrend: Array.from({ length: 30 }).map((_, index) => ({
    date: new Date(Date.now() - (29 - index) * 24 * 60 * 60 * 1000).toISOString(),
    amount: 2000000 + Math.sin(index / 4) * 120000 + index * 1500
  }))
};

const bankLinesSample: BankLinesResponse = {
  data: [
    {
      id: 'fac-001',
      facility: 'Growth Facility',
      bank: 'ANZ',
      limit: 1500000,
      drawn: 825000,
      utilisation: 55,
      maturityDate: new Date(Date.now() + 220 * 24 * 60 * 60 * 1000).toISOString(),
      costOfFundsBps: 245,
      status: 'active'
    },
    {
      id: 'fac-002',
      facility: 'Acquisition Bridge',
      bank: 'NAB',
      limit: 2100000,
      drawn: 1460000,
      utilisation: 69.5,
      maturityDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
      costOfFundsBps: 265,
      status: 'review'
    }
  ],
  pagination: {
    page: 1,
    perPage: 10,
    total: 2
  },
  totals: {
    aggregateLimit: 3600000,
    aggregateDrawn: 2285000,
    averageUtilisation: 62.3
  }
};

const scenarios: Scenario[] = [
  {
    path: '/',
    seed: (client) => {
      client.setQueryData(dashboardQueryOptions.queryKey, dashboardSample);
    }
  },
  {
    path: '/bank-lines',
    seed: (client) => {
      client.setQueryData(bankLinesQueryOptions(1, 10).queryKey, bankLinesSample);
    }
  }
];

const runScenario = async ({ path, seed }: Scenario) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        retry: false
      }
    }
  });

  seed(queryClient);

  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createAppRouter(queryClient, { history });
  await router.load();

  const { container, unmount } = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  const results = await axe.run(container, {
    reporter: 'v2'
  });

  unmount();
  cleanup();

  if (results.violations.length) {
    const formatted = results.violations
      .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)
      .join('\n');
    throw new Error(`Accessibility violations detected on ${path}:\n${formatted}`);
  }
};

const main = async () => {
  for (const scenario of scenarios) {
    await runScenario(scenario);
  }

  console.log('axe: no accessibility violations detected');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
