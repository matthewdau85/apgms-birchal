export type BankLine = {
  id: string;
  bank: string;
  product: string;
  limit: number;
  utilized: number;
  rptStatus: 'pending' | 'verified' | 'flagged';
  updatedAt: string;
};

export type TimeSeriesDatum = {
  date: string;
  value: number;
};

export type DashboardData = {
  kpis: Array<{
    label: string;
    value: string;
    delta: string;
    direction: 'up' | 'down' | 'neutral';
  }>;
  timeSeries: TimeSeriesDatum[];
  bankLines: BankLine[];
};

const makeTimeSeries = (): TimeSeriesDatum[] => {
  const today = new Date();
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));
    const baseline = 22_000_000;
    const variance = Math.sin(index / 5) * 4_000_000 + Math.random() * 1_000_000;
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.round(baseline + variance)
    };
  });
};

const BANK_LINES: BankLine[] = [
  {
    id: '1',
    bank: 'First Pacific',
    product: 'Warehouse',
    limit: 120_000_000,
    utilized: 78_500_000,
    rptStatus: 'pending',
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    bank: 'Union Trust',
    product: 'Revolver',
    limit: 95_000_000,
    utilized: 61_200_000,
    rptStatus: 'verified',
    updatedAt: new Date(Date.now() - 86_400_000 * 5).toISOString()
  },
  {
    id: '3',
    bank: 'Heritage Capital',
    product: 'Warehouse',
    limit: 140_000_000,
    utilized: 109_000_000,
    rptStatus: 'flagged',
    updatedAt: new Date(Date.now() - 86_400_000 * 2).toISOString()
  },
  {
    id: '4',
    bank: 'Sierra Financial',
    product: 'Term Loan',
    limit: 80_000_000,
    utilized: 40_500_000,
    rptStatus: 'pending',
    updatedAt: new Date(Date.now() - 86_400_000 * 9).toISOString()
  },
  {
    id: '5',
    bank: 'Harborview Bank',
    product: 'Warehouse',
    limit: 115_000_000,
    utilized: 90_200_000,
    rptStatus: 'pending',
    updatedAt: new Date(Date.now() - 86_400_000 * 3).toISOString()
  },
  {
    id: '6',
    bank: 'Evergreen Mutual',
    product: 'Revolver',
    limit: 60_000_000,
    utilized: 31_800_000,
    rptStatus: 'verified',
    updatedAt: new Date(Date.now() - 86_400_000 * 11).toISOString()
  }
];

export const fetchDashboardData = async (): Promise<DashboardData> => {
  await new Promise((resolve) => setTimeout(resolve, 600));

  return {
    kpis: [
      { label: 'Outstanding Balance', value: '$378M', delta: '+3.4% MoM', direction: 'up' },
      { label: 'Active Lines', value: '24', delta: '+2 new', direction: 'up' },
      { label: 'Utilization', value: '71%', delta: '-1.1% WoW', direction: 'down' },
      { label: 'Upcoming Maturities', value: '3', delta: 'No change', direction: 'neutral' }
    ],
    timeSeries: makeTimeSeries(),
    bankLines: BANK_LINES
  };
};
