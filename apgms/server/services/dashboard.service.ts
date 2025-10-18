import { getDefaultPrisma, toNumber, type PrismaService } from "./types";

export interface DashboardSummary {
  org: { id: string; name: string } | null;
  metrics: {
    userCount: number;
    bankLineTotal: number;
    policyCount: number;
    allocationTotal: number;
  };
  latestAudit: { id: string; actor: string; action: string; createdAt: string } | null;
}

export const getDashboardSummary = async (
  orgId: string,
  prismaClient: PrismaService = getDefaultPrisma(),
): Promise<DashboardSummary> => {
  const [org, userCount, bankLineAggregate, policyCount, allocationAggregate, latestAudit] =
    await Promise.all([
      prismaClient.org.findUnique({
        where: { id: orgId },
        select: { id: true, name: true },
      }),
      prismaClient.user.count({ where: { orgId } }),
      prismaClient.bankLine.aggregate({
        where: { orgId },
        _sum: { amount: true },
      }),
      prismaClient.policy.count({ where: { orgId } }),
      prismaClient.allocation.aggregate({
        where: { orgId },
        _sum: { amount: true },
      }),
      prismaClient.auditLog.findFirst({
        where: { orgId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return {
    org,
    metrics: {
      userCount,
      bankLineTotal: toNumber(bankLineAggregate._sum.amount),
      policyCount,
      allocationTotal: toNumber(allocationAggregate._sum.amount),
    },
    latestAudit: latestAudit
      ? {
          id: latestAudit.id,
          actor: latestAudit.actor,
          action: latestAudit.action,
          createdAt: latestAudit.createdAt.toISOString(),
        }
      : null,
  };
};
