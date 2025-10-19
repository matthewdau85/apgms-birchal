import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  withCredentials: true
});

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') {
    return config;
  }

  const token = window.localStorage.getItem('dev:bearer-token');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});

export interface DashboardKpi {
  id: string;
  label: string;
  value: number;
  delta?: number;
  deltaDirection?: 'up' | 'down';
}

export interface DashboardTrendPoint {
  date: string;
  amount: number;
}

export interface DashboardResponse {
  asOf: string;
  kpis: DashboardKpi[];
  cashTrend: DashboardTrendPoint[];
}

export interface BankLine {
  id: string;
  facility: string;
  bank: string;
  limit: number;
  drawn: number;
  utilisation: number;
  maturityDate: string;
  costOfFundsBps: number;
  status: 'active' | 'pending' | 'review';
}

export interface BankLinesResponse {
  data: BankLine[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
  };
  totals: {
    aggregateLimit: number;
    aggregateDrawn: number;
    averageUtilisation: number;
  };
}

export const fetchDashboard = async (): Promise<DashboardResponse> => {
  const { data } = await api.get<DashboardResponse>('/dashboard');
  return data;
};

export const fetchBankLines = async (params: {
  page: number;
  perPage: number;
}): Promise<BankLinesResponse> => {
  const { data } = await api.get<BankLinesResponse>('/bank-lines', {
    params
  });
  return data;
};

export const verifyRpt = async (facilityId: string): Promise<void> => {
  await api.post(`/audit/rpt/${facilityId}`);
};

export { api };
