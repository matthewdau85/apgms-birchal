import axios from 'axios';

export const http = axios.create({
  baseURL: 'http://localhost:3000',
  withCredentials: false
});

export interface DashboardKpi {
  id: string;
  label: string;
  value: number;
  delta?: number;
  deltaLabel?: string;
  currency?: string;
}

export interface DashboardChartPoint {
  date: string;
  value: number;
}

export interface DashboardData {
  kpis: DashboardKpi[];
  chart: DashboardChartPoint[];
  lastUpdated?: string;
}

export interface BankLine {
  id: string;
  institution: string;
  facilityType: string;
  limit: number;
  outstanding: number;
  currency: string;
  updatedAt?: string;
  status?: string;
}

export interface BankLinesParams {
  page: number;
  perPage: number;
}

export interface BankLinesResponse {
  data: BankLine[];
  total: number;
  page: number;
  perPage: number;
}

const toNumber = (value: unknown, fallback = 0): number => {
  const numberValue = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
};

export async function fetchDashboard(): Promise<DashboardData> {
  const response = await http.get('/dashboard');
  const raw = response.data ?? {};

  const rawKpis = Array.isArray(raw.kpis) ? raw.kpis : [];
  const kpis: DashboardKpi[] = rawKpis.map((item: Record<string, unknown>, index) => {
    const label = toString(item.label ?? item.title ?? `Metric ${index + 1}`, `Metric ${index + 1}`);
    const delta = toOptionalNumber(item.delta ?? item.change);
    return {
      id: toString(item.id ?? label ?? `metric-${index}`, `metric-${index}`),
      label,
      value: toNumber(item.value ?? item.amount ?? 0),
      delta,
      deltaLabel: toString(item.deltaLabel ?? item.changeLabel ?? '') || undefined,
      currency: toString(item.currency ?? item.ccy ?? '', '') || undefined
    };
  });

  const rawChart = Array.isArray(raw.chart) ? raw.chart : [];
  const chart: DashboardChartPoint[] = rawChart
    .map((point: Record<string, unknown>) => {
      const date = toString(point.date ?? point.day ?? point.timestamp ?? '', '');
      if (!date) {
        return null;
      }
      return {
        date,
        value: toNumber(point.value ?? point.amount ?? point.total ?? 0)
      };
    })
    .filter((value): value is DashboardChartPoint => value !== null);

  const lastUpdatedValue = raw.lastUpdated ?? raw.updatedAt ?? raw.updated_at;
  const lastUpdated = typeof lastUpdatedValue === 'string' && lastUpdatedValue.trim().length > 0 ? lastUpdatedValue : undefined;

  return {
    kpis,
    chart,
    lastUpdated
  };
}

export async function fetchBankLines({ page, perPage }: BankLinesParams): Promise<BankLinesResponse> {
  const response = await http.get('/bank-lines', {
    params: {
      page,
      perPage
    }
  });
  const raw = response.data ?? {};
  const rawData = Array.isArray(raw.data) ? raw.data : [];

  const data: BankLine[] = rawData.map((item: Record<string, unknown>, index) => {
    const fallbackId = `line-${page}-${index}`;
    return {
      id: toString(item.id ?? item.uuid ?? fallbackId, fallbackId),
      institution: toString(item.institution ?? item.bank ?? item.name ?? 'Unknown institution', 'Unknown institution'),
      facilityType: toString(item.facilityType ?? item.type ?? 'Credit facility', 'Credit facility'),
      limit: toNumber(item.limit ?? item.capacity ?? 0),
      outstanding: toNumber(item.outstanding ?? item.drawn ?? 0),
      currency: toString(item.currency ?? 'USD', 'USD'),
      updatedAt: toString(
        item.updatedAt ?? item.updated_at ?? item.reportedAt ?? item.reported_at ?? item.createdAt ?? item.created_at ?? '',
        ''
      ) || undefined,
      status: toString(item.status ?? item.state ?? '', '') || undefined
    };
  });

  const totalRaw = typeof raw.total === 'number' ? raw.total : raw.count;
  const total = typeof totalRaw === 'number' ? totalRaw : toNumber(totalRaw, data.length);

  return {
    data,
    total,
    page,
    perPage
  };
}

export async function verifyBankLineRpt(id: string): Promise<void> {
  if (!id) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 600);
  });
}
