import { getDefaultPrisma, type PrismaService } from "./types";

export interface AuditEntry {
  id: string;
  orgId: string;
  actor: string;
  action: string;
  createdAt: string;
  details?: unknown;
}

export const getAuditLog = async (
  orgId: string,
  prismaClient: PrismaService = getDefaultPrisma(),
): Promise<AuditEntry[]> => {
  const entries = await prismaClient.auditLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return entries.map((entry) => ({
    id: entry.id,
    orgId: entry.orgId,
    actor: entry.actor,
    action: entry.action,
    createdAt: entry.createdAt.toISOString(),
    details: entry.details ?? undefined,
  }));
};
