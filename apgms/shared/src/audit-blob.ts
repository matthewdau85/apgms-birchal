import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { generateId } from "./id";

type JsonValue = Prisma.JsonValue;

export type AuditBlobRecord = {
  id: string;
  kind: string;
  payloadJson: JsonValue;
  orgId?: string;
  gateId?: string;
  createdAt: string;
};

const auditStore: AuditBlobRecord[] = [];

export async function recordAuditBlob(input: {
  kind: string;
  payloadJson: JsonValue;
  orgId?: string;
  gateId?: string;
}): Promise<AuditBlobRecord> {
  const record: AuditBlobRecord = {
    id: generateId("ab"),
    kind: input.kind,
    payloadJson: input.payloadJson,
    orgId: input.orgId,
    gateId: input.gateId,
    createdAt: new Date().toISOString(),
  };

  auditStore.push(record);

  const auditClient = (prisma as any).auditBlob;
  if (auditClient?.create) {
    try {
      await auditClient.create({
        data: {
          id: record.id,
          kind: record.kind,
          payloadJson: record.payloadJson,
          orgId: record.orgId ?? null,
          gateId: record.gateId ?? null,
          createdAt: new Date(record.createdAt),
        },
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("failed to persist audit blob", err);
      }
    }
  }

  return record;
}

export function listAuditBlobs(): readonly AuditBlobRecord[] {
  return auditStore;
}

export function resetAuditBlobs(): void {
  auditStore.splice(0, auditStore.length);
}
