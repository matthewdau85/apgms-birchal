import type { ChartPoint } from '../components/LineChart';

export type DashboardResponse = {
  kpis: Array<{
    id: string;
    label: string;
    value: number;
    change: number;
  }>;
  chart: ChartPoint[];
};

export type BankLine = {
  id: string;
  institution: string;
  limit: number;
  utilised: number;
  status: 'Active' | 'Pending' | 'Closed';
  nextReview: string;
};

export type BankLinesResponse = {
  data: BankLine[];
  page: number;
  totalPages: number;
};

export type AuditReport = {
  summary: string;
  lastReviewed: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sampleBankLines: BankLine[] = Array.from({ length: 24 }).map((_, index) => ({
  id: `line-${index + 1}`,
  institution: ['ANZ', 'NAB', 'Westpac', 'CBA'][index % 4],
  limit: 750000 + index * 15000,
  utilised: 480000 + index * 9000,
  status: (['Active', 'Pending', 'Closed'] as const)[index % 3],
  nextReview: new Date(Date.now() + index * 86400000).toISOString(),
}));

const sampleChart: ChartPoint[] = Array.from({ length: 30 }).map((_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - index));
  return {
    date: date.toISOString(),
    value: 450000 + Math.sin(index / 4) * 55000 + index * 1200,
  };
});

export async function getDashboard(): Promise<DashboardResponse> {
  await sleep(400);
  return {
    kpis: [
      { id: 'cash', label: 'Available Cash', value: 1840000, change: 5.4 },
      { id: 'utilisation', label: 'Utilisation', value: 71, change: -2.1 },
      { id: 'overdraft', label: 'Overdraft Usage', value: 14, change: 1.3 },
      { id: 'forecast', label: '30d Forecast', value: 2100000, change: 3.8 },
    ],
    chart: sampleChart,
  };
}

export async function getBankLines(page: number, pageSize = 6): Promise<BankLinesResponse> {
  await sleep(350);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const data = sampleBankLines.slice(start, end);
  return {
    data,
    page,
    totalPages: Math.ceil(sampleBankLines.length / pageSize),
  };
}

export async function getAuditReport(lineId: string): Promise<AuditReport> {
  try {
    const response = await fetch(`/audit/rpt/by-line/${lineId}`);
    if (response.ok) {
      return (await response.json()) as AuditReport;
    }
  } catch (error) {
    // Swallow errors to avoid console noise while still attempting the API call.
  }

  await sleep(250);
  return {
    summary: 'No audit trail is available right now. We will refresh this shortly.',
    lastReviewed: new Date().toISOString(),
  };
}
