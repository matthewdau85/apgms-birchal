export interface KpiMetric {
  id: string;
  label: string;
  value: number;
  delta: number;
  trend: 'up' | 'down';
}

export interface DashboardSummary {
  metrics: KpiMetric[];
  chart: Array<{ date: string; inflow: number; outflow: number }>;
}

const generateChartData = () => {
  const today = new Date();
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));
    const inflow = 700000 + Math.random() * 150000;
    const outflow = 500000 + Math.random() * 120000;
    return {
      date: date.toISOString(),
      inflow,
      outflow,
    };
  });
};

export const fetchDashboardSummary = async (): Promise<DashboardSummary> => {
  await new Promise((resolve) => setTimeout(resolve, 320));

  const metrics: KpiMetric[] = [
    { id: 'working-capital', label: 'Working Capital', value: 18800000, delta: 2.3, trend: 'up' },
    { id: 'utilization', label: 'Utilization', value: 0.68, delta: -1.2, trend: 'down' },
    { id: 'new-payments', label: 'Payments Cleared', value: 1260, delta: 5.8, trend: 'up' },
    { id: 'discrepancies', label: 'Discrepancies', value: 14, delta: -3.0, trend: 'down' },
  ];

  return {
    metrics,
    chart: generateChartData(),
  };
};
