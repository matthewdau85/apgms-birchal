import { getDefaultPrisma, toNumber, type PrismaService } from "./types";

export interface BankLineItem {
  id: string;
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  description: string;
}

export const getBankLines = async (
  orgId: string,
  prismaClient: PrismaService = getDefaultPrisma(),
): Promise<BankLineItem[]> => {
  const lines = await prismaClient.bankLine.findMany({
    where: { orgId },
    orderBy: { date: "desc" },
  });

  return lines.map((line) => ({
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amount: toNumber(line.amount),
    payee: line.payee,
    description: line.desc,
  }));
};
