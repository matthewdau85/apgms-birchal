import { getDefaultPrisma, toNumber, type PrismaService } from "./types";

export interface AllocationItem {
  id: string;
  orgId: string;
  portfolio: string;
  amount: number;
  currency: string;
  updatedAt: string;
}

export const getAllocations = async (
  orgId: string,
  prismaClient: PrismaService = getDefaultPrisma(),
): Promise<AllocationItem[]> => {
  const allocations = await prismaClient.allocation.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
  });

  return allocations.map((allocation) => ({
    id: allocation.id,
    orgId: allocation.orgId,
    portfolio: allocation.portfolio,
    amount: toNumber(allocation.amount),
    currency: allocation.currency,
    updatedAt: allocation.updatedAt.toISOString(),
  }));
};
