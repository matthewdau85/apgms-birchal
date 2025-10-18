export interface DashboardSummary {
  totalPolicies: number;
  activePolicies: number;
  totalExposure: number;
  currency: string;
  lastUpdated: string;
}

export interface BankLine {
  id: string;
  institution: string;
  country: string;
  limit: number;
  utilised: number;
  currency: string;
  effectiveDate: string;
  expiryDate: string;
}

export interface BankLinePolicy {
  number: string;
  status: 'active' | 'expired' | 'pending';
  coveragePercentage: number;
  coverageAmount: number;
}

export interface BankLineParticipation {
  rptNumber: string;
  participationPercentage: number;
  notes?: string;
}

export interface BankLineDetail extends BankLine {
  policy: BankLinePolicy;
  participation: BankLineParticipation;
  comments?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const mockDashboardSummary: DashboardSummary = {
  totalPolicies: 42,
  activePolicies: 29,
  totalExposure: 185_000_000,
  currency: 'AUD',
  lastUpdated: new Date().toISOString(),
};

const mockBankLineDetails: BankLineDetail[] = [
  {
    id: 'line-1',
    institution: 'Commonwealth Bank of Australia',
    country: 'Australia',
    limit: 50_000_000,
    utilised: 38_500_000,
    currency: 'AUD',
    effectiveDate: '2023-01-01',
    expiryDate: '2024-12-31',
    policy: {
      number: 'POL-AU-1001',
      status: 'active',
      coveragePercentage: 85,
      coverageAmount: 42_500_000,
    },
    participation: {
      rptNumber: 'RPT-7781',
      participationPercentage: 40,
      notes: 'Syndicated with two counterparties.',
    },
    comments: 'Renewal discussion scheduled for Q3.',
  },
  {
    id: 'line-2',
    institution: 'HSBC',
    country: 'Hong Kong',
    limit: 35_000_000,
    utilised: 12_750_000,
    currency: 'USD',
    effectiveDate: '2022-07-15',
    expiryDate: '2024-07-14',
    policy: {
      number: 'POL-HK-4450',
      status: 'active',
      coveragePercentage: 70,
      coverageAmount: 24_500_000,
    },
    participation: {
      rptNumber: 'RPT-9024',
      participationPercentage: 55,
      notes: 'RPT renewed in February 2024.',
    },
    comments: 'Monitoring utilisation for APAC expansion.',
  },
  {
    id: 'line-3',
    institution: 'BNP Paribas',
    country: 'France',
    limit: 60_000_000,
    utilised: 15_250_000,
    currency: 'EUR',
    effectiveDate: '2023-06-01',
    expiryDate: '2025-05-31',
    policy: {
      number: 'POL-EU-3322',
      status: 'pending',
      coveragePercentage: 65,
      coverageAmount: 39_000_000,
    },
    participation: {
      rptNumber: 'RPT-6610',
      participationPercentage: 45,
    },
    comments: 'Awaiting final credit approval from partner bank.',
  },
];

const mockBankLines: BankLine[] = mockBankLineDetails.map(({ participation, policy, comments, ...summary }) => summary);

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchWithFallback<T>(path: string, fallback: T): Promise<T> {
  try {
    return await fetchJson<T>(path);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Falling back to mock data for ${path}:`, error);
    }
    return fallback;
  }
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return fetchWithFallback<DashboardSummary>('/dashboard/summary', mockDashboardSummary);
}

export async function getBankLines(): Promise<BankLine[]> {
  return fetchWithFallback<BankLine[]>('/bank-lines', mockBankLines);
}

export async function getBankLineDetail(id: string): Promise<BankLineDetail> {
  try {
    return await fetchJson<BankLineDetail>(`/bank-lines/${id}`);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Falling back to mock bank line detail for ${id}:`, error);
    }
    const fallback = mockBankLineDetails.find((line) => line.id === id);
    if (!fallback) {
      throw new Error(`Bank line ${id} not found in fallback data.`);
    }
    return fallback;
  }
}
