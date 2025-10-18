import { createHash } from "node:crypto";

export interface PolicyBankLine {
  id: string;
  amount: number;
  payee: string;
  desc: string;
  date: Date;
}

export interface Allocation {
  accountId: string;
  amount: number;
}

export interface ApplyPolicyInput {
  orgId: string;
  bankLine: PolicyBankLine;
}

export interface ApplyPolicyResult {
  policyHash: string;
  allocations: Allocation[];
}

function normalizeAccountId(orgId: string, payee: string): string {
  const normalized = payee
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0
    ? `acct:${orgId}:${normalized}`
    : `acct:${orgId}:unclassified`;
}

export function applyPolicy(input: ApplyPolicyInput): ApplyPolicyResult {
  const { orgId, bankLine } = input;
  const amount = Number(bankLine.amount);
  if (!Number.isFinite(amount)) {
    throw new Error("bank line amount must be a finite number");
  }
  if (amount < 0) {
    throw new Error("bank line amount must be non-negative");
  }

  const accountId = normalizeAccountId(orgId, bankLine.payee);
  const allocations: Allocation[] = [
    { accountId, amount },
  ];

  const canonical = JSON.stringify({
    orgId,
    bankLineId: bankLine.id,
    allocations,
  });
  const policyHash = createHash("sha256").update(canonical).digest("hex");

  const sum = allocations.reduce((acc, entry) => acc + entry.amount, 0);
  if (Math.abs(sum - amount) > 1e-9) {
    throw new Error("allocations violate conservation");
  }
  if (allocations.some((entry) => entry.amount < 0)) {
    throw new Error("allocations must be non-negative");
  }

  return { policyHash, allocations };
}
