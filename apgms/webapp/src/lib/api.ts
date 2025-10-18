export type ChartPoint = {
  date: string;
  value: number;
};

export type DashboardSummary = {
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
  date: string;
  description: string;
  amount: number;
  status: 'pending' | 'verified' | 'flagged';
  counterparty: string;
  rptExcerpt: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

type FetchBankLinesParams = {
  page: number;
  pageSize: number;
  signal?: AbortSignal;
};

const dashboardSummary: DashboardSummary = {
  kpis: [
    { id: 'operating', label: 'Operating', value: 482430.45, change: 3.8 },
    { id: 'tax-buffer', label: 'Tax buffer', value: 128930.12, change: -1.6 },
    { id: 'paygw', label: 'PAYGW', value: 80210.76, change: 0.4 },
    { id: 'gst', label: 'GST', value: 55330.18, change: 1.1 }
  ],
  chart: generateChart()
};

const bankLineStore: BankLine[] = generateBankLines();

export async function fetchDashboardSummary({ signal }: { signal?: AbortSignal } = {}): Promise<DashboardSummary> {
  await delay(180, signal);
  return JSON.parse(JSON.stringify(dashboardSummary));
}

export async function fetchBankLines({ page, pageSize, signal }: FetchBankLinesParams): Promise<Paginated<BankLine>> {
  await delay(220, signal);
  const start = page * pageSize;
  const end = start + pageSize;
  const items = bankLineStore.slice(start, end).map((item) => ({ ...item }));
  return {
    items,
    page,
    pageSize,
    total: bankLineStore.length
  };
}

export async function verifyBankLine(id: string, { signal }: { signal?: AbortSignal } = {}): Promise<BankLine> {
  await delay(150, signal);
  const line = bankLineStore.find((item) => item.id === id);
  if (!line) {
    throw new Error('Bank line not found');
  }
  line.status = 'verified';
  return { ...line };
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    function onAbort() {
      cleanup();
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      reject(abortError);
    }

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort);
    }
  });
}

function generateChart(): ChartPoint[] {
  const today = new Date();
  const points: ChartPoint[] = [];
  let base = 410000;
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    base += Math.sin(i / 3) * 3000 + Math.random() * 1200 - 600;
    points.push({ date: date.toISOString(), value: Math.max(base, 320000) });
  }
  return points;
}

function generateBankLines(): BankLine[] {
  const statuses: BankLine['status'][] = ['pending', 'verified', 'flagged'];
  const descriptions = [
    'Investor disbursement',
    'Birchal platform fee',
    'ATO remittance',
    'Custody provider invoice',
    'Insurance premium',
    'R&D rebate deposit',
    'Regulatory filing fee'
  ];
  const lines: BankLine[] = [];
  const today = new Date();
  for (let i = 0; i < 64; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    lines.push({
      id: `line-${i + 1}`,
      date: date.toISOString(),
      description: descriptions[i % descriptions.length],
      amount: Number((Math.random() * 18000 - 9000).toFixed(2)),
      status: statuses[i % statuses.length],
      counterparty: ['Birchal Nominees', 'ATO', 'Macquarie Bank'][i % 3],
      rptExcerpt:
        'Reference Payment Transaction (RPT) data indicates reconciliation with ledger entry \u2013 supporting documents attached.'
    });
  }
  return lines;
}
