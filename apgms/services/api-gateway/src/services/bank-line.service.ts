import { prisma } from "@apgms/shared/src/db";

export interface BankLineInput {
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  description: string;
}

export interface BankLineSummary {
  id: string;
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  description: string;
  createdAt: string;
}

function normalizeBankLine(line: {
  id: string;
  orgId: string;
  date: Date;
  amount: unknown;
  payee: string;
  desc: string;
  createdAt: Date;
}): BankLineSummary {
  return {
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amount: typeof line.amount === "number" ? line.amount : Number(line.amount),
    payee: line.payee,
    description: line.desc,
    createdAt: line.createdAt.toISOString(),
  };
}

export const bankLineService = {
  async listBankLines(take: number): Promise<BankLineSummary[]> {
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take,
    });

    return lines.map(normalizeBankLine);
  },

  async createBankLine(input: BankLineInput): Promise<BankLineSummary> {
    const created = await prisma.bankLine.create({
      data: {
        orgId: input.orgId,
        date: new Date(input.date),
        amount: input.amount,
        payee: input.payee,
        desc: input.description,
      },
    });

    return normalizeBankLine(created);
  },
};
