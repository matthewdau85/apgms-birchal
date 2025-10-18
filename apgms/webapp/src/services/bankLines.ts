export type LineStatus = 'Active' | 'Pending Review' | 'On Hold';

export interface BankLine {
  id: string;
  lineName: string;
  institution: string;
  limit: number;
  balance: number;
  updatedAt: string;
  status: LineStatus;
  riskScore: number;
}

const lines: BankLine[] = [
  {
    id: 'ln-1001',
    lineName: 'Operating Line - North Region',
    institution: 'First Commonwealth',
    limit: 5000000,
    balance: 2875000,
    updatedAt: new Date().toISOString(),
    status: 'Active',
    riskScore: 18,
  },
  {
    id: 'ln-1002',
    lineName: 'Seasonal Inventory Facility',
    institution: 'Atlantic Trust',
    limit: 7200000,
    balance: 6540000,
    updatedAt: new Date().toISOString(),
    status: 'Pending Review',
    riskScore: 47,
  },
  {
    id: 'ln-1003',
    lineName: 'Expansion Project - Phase II',
    institution: 'Greenwood Capital',
    limit: 9800000,
    balance: 7125000,
    updatedAt: new Date().toISOString(),
    status: 'Active',
    riskScore: 32,
  },
  {
    id: 'ln-1004',
    lineName: 'Supplier Financing Bloc',
    institution: 'Unity Credit',
    limit: 4200000,
    balance: 3210000,
    updatedAt: new Date().toISOString(),
    status: 'On Hold',
    riskScore: 62,
  },
  {
    id: 'ln-1005',
    lineName: 'Emergency Liquidity Pool',
    institution: 'National Allied',
    limit: 6000000,
    balance: 2100000,
    updatedAt: new Date().toISOString(),
    status: 'Active',
    riskScore: 24,
  },
  {
    id: 'ln-1006',
    lineName: 'Receivables Backstop Facility',
    institution: 'Summit Partners',
    limit: 8600000,
    balance: 5030000,
    updatedAt: new Date().toISOString(),
    status: 'Pending Review',
    riskScore: 56,
  },
  {
    id: 'ln-1007',
    lineName: 'Bridge Credit Line',
    institution: 'Northern Lights Bank',
    limit: 4500000,
    balance: 3590000,
    updatedAt: new Date().toISOString(),
    status: 'Active',
    riskScore: 28,
  },
  {
    id: 'ln-1008',
    lineName: 'Capital Projects Facility',
    institution: 'Cedar & Co.',
    limit: 7200000,
    balance: 4880000,
    updatedAt: new Date().toISOString(),
    status: 'Active',
    riskScore: 34,
  },
  {
    id: 'ln-1009',
    lineName: 'Treasury Buffer',
    institution: 'Skyline Financial',
    limit: 3000000,
    balance: 1890000,
    updatedAt: new Date().toISOString(),
    status: 'Active',
    riskScore: 15,
  },
  {
    id: 'ln-1010',
    lineName: 'Payments Corridor Facility',
    institution: 'HarborPoint',
    limit: 5600000,
    balance: 4800000,
    updatedAt: new Date().toISOString(),
    status: 'Pending Review',
    riskScore: 51,
  },
  {
    id: 'ln-1011',
    lineName: 'Accounts Payable Bridge',
    institution: 'Union Exchange',
    limit: 6100000,
    balance: 5800000,
    updatedAt: new Date().toISOString(),
    status: 'On Hold',
    riskScore: 68,
  },
  {
    id: 'ln-1012',
    lineName: 'FX Settlement Buffer',
    institution: 'GlobeTrust',
    limit: 4800000,
    balance: 2750000,
    updatedAt: new Date().toISOString(),
    status: 'Active',
    riskScore: 22,
  },
];

export const fetchBankLines = async (): Promise<BankLine[]> => {
  await new Promise((resolve) => setTimeout(resolve, 420));
  return lines;
};

export const verifyRptForLine = async (lineId: string) => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.info(`Verify RPT requested for line ${lineId} -> /audit/rpt/by-line/${lineId}`);
  return { status: 'ok', lineId } as const;
};
