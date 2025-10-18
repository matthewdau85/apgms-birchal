import { prisma } from "@apgms/shared/src/db";

export interface ReconciliationResult {
  orgId: string;
  totalCredits: number;
  totalDebits: number;
  netBalance: number;
  transactionCount: number;
}

export const reconciliationService = {
  async getOrgReconciliation(orgId: string): Promise<ReconciliationResult> {
    const lines = await prisma.bankLine.findMany({
      where: { orgId },
      orderBy: { date: "desc" },
    });

    const totals = lines.reduce(
      (acc, line) => {
        const amount = Number(line.amount);
        if (amount >= 0) {
          acc.credits += amount;
        } else {
          acc.debits += amount;
        }
        return acc;
      },
      { credits: 0, debits: 0 },
    );

    return {
      orgId,
      totalCredits: Number(totals.credits.toFixed(2)),
      totalDebits: Number(totals.debits.toFixed(2)),
      netBalance: Number((totals.credits + totals.debits).toFixed(2)),
      transactionCount: lines.length,
    };
  },
};
