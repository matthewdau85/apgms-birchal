import { Decimal } from "@prisma/client/runtime/library";

export type BankLineLike = {
  amount: number;
  payee: string;
  desc: string;
};

export type RuleLike = {
  payeeRegex?: string | null;
  minAmount?: number | Decimal | null;
  maxAmount?: number | Decimal | null;
  containsDesc?: string | null;
};

const normalizeAmount = (value: number | Decimal | null | undefined): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return value;
  }
  return value.toNumber();
};

export function matchRule(line: BankLineLike, rule: RuleLike): boolean {
  const payee = line.payee ?? "";
  const desc = line.desc ?? "";

  if (rule.payeeRegex) {
    try {
      const regex = new RegExp(rule.payeeRegex);
      if (!regex.test(payee)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  const minAmount = normalizeAmount(rule.minAmount);
  if (minAmount !== undefined && line.amount < minAmount) {
    return false;
  }

  const maxAmount = normalizeAmount(rule.maxAmount);
  if (maxAmount !== undefined && line.amount > maxAmount) {
    return false;
  }

  if (rule.containsDesc) {
    const needle = rule.containsDesc.toLowerCase();
    if (!desc.toLowerCase().includes(needle)) {
      return false;
    }
  }

  return true;
}
