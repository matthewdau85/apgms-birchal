import type { BankLineCreate, BankLineCreateInput } from "../schemas";
import { bankLineCreateSchema } from "../schemas";

export function normalizeBankLine(input: BankLineCreateInput): BankLineCreate {
  return bankLineCreateSchema.parse(input);
}

export type RunningBalanceEntry = {
  date: Date;
  amount: number;
  balance: number;
};

export function calculateRunningBalance(
  lines: Array<Pick<BankLineCreate, "date" | "amount">>,
  openingBalance = 0,
): RunningBalanceEntry[] {
  let balance = Number(openingBalance.toFixed(2));
  return [...lines]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((line) => {
      balance = Number((balance + Number(line.amount)).toFixed(2));
      return {
        date: line.date,
        amount: Number(line.amount),
        balance,
      };
    });
}

export function clampTake(take: number, min = 1, max = 200): number {
  return Math.min(Math.max(Math.trunc(take), min), max);
}
