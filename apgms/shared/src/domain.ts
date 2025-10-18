export interface AccountSnapshot {
  accountId: string;
  name: string;
  balance: number;
  currency: string;
  institution: string;
}

export type TransactionType = "credit" | "debit";

export interface FinancialTransaction {
  transactionId: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  postedAt: string;
  category?: string;
  reference?: string;
}

export interface PaymentInstruction {
  paymentId: string;
  amount: number;
  currency: string;
  beneficiary: string;
  remittanceInformation: string;
  dueDate: string;
  scheme?: string;
  metadata?: Record<string, unknown>;
}

export interface RegistryInstruction {
  registry: string;
  changes: Record<string, unknown>;
}

export interface ConnectorDataset {
  accounts: AccountSnapshot[];
  transactions: FinancialTransaction[];
  paymentsDue: PaymentInstruction[];
  registryInstructions: RegistryInstruction[];
  reportingPeriod: string;
  metadata?: Record<string, unknown>;
}

export interface ReconciliationSummary {
  transactionCount: number;
  totalCredits: number;
  totalDebits: number;
  settledPayments: number;
  failedPayments: number;
  unmatchedPayments: number;
}
