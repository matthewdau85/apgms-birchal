import { useMemo } from 'react';
import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { rootRoute } from '@/routes/__root';
import { getDashboardSummary } from '@/lib/api';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
  });

  const stats = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Total Policies',
        value: data.totalPolicies.toLocaleString(),
        description: 'All policies managed within the APGMS platform.',
      },
      {
        label: 'Active Policies',
        value: data.activePolicies.toLocaleString(),
        description: 'Policies currently providing exposure coverage.',
      },
      {
        label: 'Total Exposure',
        value: formatCurrency(data.totalExposure, data.currency),
        description: 'Aggregate gross exposure across all counterparties.',
      },
    ];
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of key policy and exposure metrics for the current portfolio.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardHeader>
                <CardTitle className="h-6 w-24 rounded bg-muted" />
                <CardDescription className="h-4 w-32 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        {!isLoading &&
          !isError &&
          stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader>
                <CardTitle>{stat.value}</CardTitle>
                <CardDescription>{stat.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        {isError && (
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>Unable to load dashboard</CardTitle>
              <CardDescription>{(error as Error).message}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Operational context</CardTitle>
            <CardDescription>
              Latest refresh {new Date(data.lastUpdated).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                Active policies represent {(data.activePolicies / data.totalPolicies * 100).toFixed(0)}% of the total
                portfolio.
              </li>
              <li>The gross exposure figure aggregates both primary and RPT coverage.</li>
              <li>
                Use the Bank Lines page to drill into policy details and risk participation structures.
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});
