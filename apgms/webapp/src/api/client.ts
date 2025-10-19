export type DashboardSummary = {
  id: string;
  label: string;
  value: number;
  change: number;
  currency?: string;
};

export type DashboardChartPoint = {
  date: string;
  inflow: number;
  outflow: number;
};

export type DashboardResponse = {
  kpis: DashboardSummary[];
  chart: DashboardChartPoint[];
};

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  const response = await fetch('/dashboard', { signal });
  if (!response.ok) {
    throw new Error('Failed to load dashboard');
  }
  return response.json();
}

export type BankLine = {
  id: string;
  name: string;
  utilization: number;
  limit: number;
  available: number;
  updatedAt: string;
  owner: string;
  status: 'active' | 'review' | 'hold';
};

export type BankLinesResponse = {
  items: BankLine[];
  page: number;
  pageSize: number;
  total: number;
};

export async function fetchBankLines(page: number, pageSize: number, signal?: AbortSignal): Promise<BankLinesResponse> {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL('/bank-lines', base);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error('Failed to load bank lines');
  }
  return response.json();
}
