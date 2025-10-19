import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

type DashboardMetric = {
  label: string;
  value: number;
  change30d?: number;
};

type DailyPoint = {
  date: string;
  value: number;
};

type DashboardResponse = {
  metrics: DashboardMetric[];
  volumeLast30Days: DailyPoint[];
};

type BankLine = {
  id: string;
  name: string;
  institution: string;
  limit: number;
  available: number;
  currency: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  lastReviewedAt?: string;
};

type Policy = {
  id: string;
  reference: string;
  insuredParty: string;
  exposureLimit: number;
  coveragePercent: number;
  effectiveFrom: string;
  effectiveTo?: string;
  rulesSummary?: string;
  rulesJson?: unknown;
};

type Gate = {
  id: string;
  name: string;
  state: 'OPEN' | 'CLOSED' | 'SCHEDULED';
  opensAt?: string;
  closesAt?: string;
  notes?: string;
};

type RptVerification = {
  rptId: string;
  bankLineId: string;
  status: 'VERIFIED' | 'PENDING' | 'FAILED';
  verifiedAt?: string;
};

export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardResponse>('/dashboard'),
    staleTime: 30_000,
    retry: 1,
  });

export const useBankLines = (q?: string) =>
  useQuery({
    queryKey: ['bank-lines', q ?? ''],
    queryFn: () =>
      apiFetch<BankLine[]>('/bank-lines', {
        searchParams: q ? { q } : undefined,
      }),
    staleTime: 15_000,
    retry: 1,
  });

export const usePolicies = () =>
  useQuery({
    queryKey: ['policies'],
    queryFn: () => apiFetch<Policy[]>('/policies'),
    staleTime: 15_000,
    retry: 1,
  });

export const useGates = () =>
  useQuery({
    queryKey: ['gates'],
    queryFn: () => apiFetch<Gate[]>('/gates'),
    staleTime: 15_000,
    retry: 1,
  });

export const useRptById = (id?: string | null, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['rpt', id],
    enabled: Boolean(id) && (options?.enabled ?? true),
    queryFn: () => apiFetch<RptVerification>(`/rpts/${id}`),
    staleTime: 5_000,
    retry: 1,
  });

export const useRptByLine = (lineId?: string | null, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['rpt-by-line', lineId],
    enabled: Boolean(lineId) && (options?.enabled ?? true),
    queryFn: () => apiFetch<RptVerification>(`/bank-lines/${lineId}/rpt`),
    staleTime: 5_000,
    retry: 1,
  });

export type { DashboardResponse, BankLine, Policy, Gate, RptVerification };
