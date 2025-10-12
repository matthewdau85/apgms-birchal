import crypto from 'node:crypto';

export interface OnboardingInput {
  readonly legalName: string;
  readonly tradingName?: string;
  readonly abn: string;
  readonly contacts: ReadonlyArray<{ name: string; email: string }>;
}

export interface OnboardingProfile {
  readonly id: string;
  readonly legalName: string;
  readonly tradingName: string;
  readonly abn: string;
  readonly primaryContact: { name: string; email: string };
  readonly createdAt: Date;
}

export interface Transaction {
  readonly id: string;
  readonly type: "sale" | "expense";
  readonly amount: number;
  readonly taxRate: number;
  readonly description?: string;
}

export interface BasDraft {
  readonly transactions: ReadonlyArray<Transaction>;
  readonly totalSales: number;
  readonly totalExpenses: number;
  readonly netPayable: number;
  readonly warnings: ReadonlyArray<string>;
}

export interface ReconciliationRecord {
  readonly reference: string;
  readonly amount: number;
}

export interface ReconciliationResult {
  readonly matched: number;
  readonly unmatched: ReadonlyArray<ReconciliationRecord>;
  readonly matchRate: number;
}

export interface DebitInstruction {
  readonly reference: string;
  readonly amount: number;
  readonly scheduledAt: Date;
  readonly status: "scheduled" | "insufficient_funds";
}

export interface RegulatoryReport {
  readonly issuedAt: Date;
  readonly draft: BasDraft;
  readonly debitReference: string;
  readonly author: string;
  readonly hash: string;
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function onboardBusiness(input: OnboardingInput, now: () => Date = () => new Date()): OnboardingProfile {
  if (!input.legalName.trim()) {
    throw new Error("Legal name is required");
  }

  if (!/^\d{11}$/.test(input.abn)) {
    throw new Error("ABN must be 11 digits");
  }

  if (!input.contacts.length) {
    throw new Error("At least one contact must be supplied");
  }

  const primary = input.contacts[0];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(primary.email)) {
    throw new Error("Primary contact email is invalid");
  }

  return {
    id: `ent_${crypto.randomUUID()}`,
    legalName: input.legalName,
    tradingName: input.tradingName ?? input.legalName,
    abn: input.abn,
    primaryContact: primary,
    createdAt: now()
  };
}

export function createBasDraft(transactions: ReadonlyArray<Transaction>): BasDraft {
  if (!transactions.length) {
    return {
      transactions,
      totalSales: 0,
      totalExpenses: 0,
      netPayable: 0,
      warnings: ["No activity for the reporting period"]
    };
  }

  let totalSales = 0;
  let totalExpenses = 0;
  const warnings: string[] = [];

  for (const txn of transactions) {
    if (txn.taxRate <= 0) {
      warnings.push(`Transaction ${txn.id} has no GST applied`);
    }

    const gross = round(txn.amount * (1 + Math.max(txn.taxRate, 0)));
    if (txn.type === "sale") {
      totalSales += gross;
    } else {
      totalExpenses += gross;
    }
  }

  return {
    transactions,
    totalSales: round(totalSales),
    totalExpenses: round(totalExpenses),
    netPayable: round(totalSales - totalExpenses),
    warnings
  };
}

export function matchReconciliation(
  draft: BasDraft,
  records: ReadonlyArray<ReconciliationRecord>,
  tolerance = 0.5
): ReconciliationResult {
  const unmatched: ReconciliationRecord[] = [];
  let matched = 0;

  for (const record of records) {
    const match = draft.transactions.find((txn) => Math.abs(txn.amount - record.amount) <= tolerance);
    if (match) {
      matched += 1;
    } else {
      unmatched.push(record);
    }
  }

  const matchRate = records.length === 0 ? 1 : matched / records.length;
  return {
    matched,
    unmatched,
    matchRate: round(matchRate, 4)
  };
}

export function scheduleDebit(
  draft: BasDraft,
  accountBalance: number,
  now: () => Date = () => new Date()
): DebitInstruction {
  const reference = `dd_${crypto.randomUUID()}`;
  const scheduledAt = now();

  if (draft.netPayable <= accountBalance) {
    return {
      reference,
      amount: draft.netPayable,
      scheduledAt,
      status: "scheduled"
    };
  }

  return {
    reference,
    amount: draft.netPayable,
    scheduledAt,
    status: "insufficient_funds"
  };
}

export function mintRegulatoryReport(
  draft: BasDraft,
  debit: DebitInstruction,
  author: string,
  now: () => Date = () => new Date()
): RegulatoryReport {
  if (debit.status !== "scheduled") {
    throw new Error("Cannot mint report until debit is scheduled");
  }

  const issuedAt = now();
  const payload = JSON.stringify({
    issuedAt: issuedAt.toISOString(),
    draft,
    debitReference: debit.reference,
    author
  });

  return {
    issuedAt,
    draft,
    debitReference: debit.reference,
    author,
    hash: crypto.createHash("sha256").update(payload).digest("hex")
  };
}
