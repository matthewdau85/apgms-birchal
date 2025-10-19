import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export interface AuditEventInput {
  userId?: string;
  orgId?: string;
  action: string;
  target?: string;
  ipAddress?: string;
  meta?: Prisma.JsonValue;
}

export const recordAuditEvent = async (input: AuditEventInput) => {
  await prisma.auditEvent.create({
    data: {
      userId: input.userId ?? null,
      orgId: input.orgId ?? null,
      action: input.action,
      target: input.target ?? null,
      ipAddress: input.ipAddress ?? null,
      meta: input.meta ?? {},
    },
  });
};
