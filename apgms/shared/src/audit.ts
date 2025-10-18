import crypto from "node:crypto";
import type { PrismaClientLike } from "./db";

export interface AuditEvent {
  actorRole: string;
  action: string;
  resource: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

function toAnchorDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function computeHash(payload: string, previous?: string | null): string {
  const hash = crypto.createHash("sha256");
  hash.update(payload);
  if (previous) {
    hash.update(previous);
  }
  return hash.digest("hex");
}

export async function appendAuditLog(prisma: PrismaClientLike, event: AuditEvent) {
  const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();
  const anchorDate = toAnchorDate(timestamp);
  const [last] = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const prevHash = last?.hash ?? null;
  const payload = JSON.stringify({
    timestamp: timestamp.toISOString(),
    actorRole: event.actorRole,
    action: event.action,
    resource: event.resource,
    metadata: event.metadata ?? {},
  });
  const hash = computeHash(payload, prevHash);
  const record = await prisma.auditLog.create({
    data: {
      actorRole: event.actorRole,
      action: event.action,
      resource: event.resource,
      metadata: event.metadata ?? {},
      createdAt: timestamp,
      prevHash,
      hash,
      anchorDate,
    },
  });
  await prisma.auditAnchor.upsert({
    where: { date: anchorDate },
    create: { date: anchorDate, hash },
    update: { hash },
  });
  return record;
}

export async function getDailyAuditBundle(prisma: PrismaClientLike, date: Date) {
  const anchorDate = toAnchorDate(date);
  const [anchor, records] = await Promise.all([
    prisma.auditAnchor.findUnique({ where: { date: anchorDate } }),
    prisma.auditLog.findMany({ where: { anchorDate }, orderBy: { createdAt: "asc" } }),
  ]);
  return { anchorDate, anchor, records };
}

export function formatAnchorDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
