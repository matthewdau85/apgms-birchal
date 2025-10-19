import { prisma } from "./db";

export async function writeAuditBlob({
  scope,
  payload,
  orgId,
}: {
  scope: string;
  payload: Record<string, unknown>;
  orgId?: string;
}) {
  return prisma.auditBlob.create({
    data: {
      scope,
      payload,
      orgId,
    },
  });
}
