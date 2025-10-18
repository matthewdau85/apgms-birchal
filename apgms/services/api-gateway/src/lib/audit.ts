import { prisma } from "../../../../shared/src/db";
import { sha256 } from "../../../../shared/src/crypto";

type AuditPayload = unknown;

interface PutAuditBlobInput {
  orgId: string;
  type: string;
  payload: AuditPayload;
}

interface AuditRecord {
  id: string;
  orgId: string;
  type: string;
  payload: AuditPayload;
  hash: string;
  prevHash: string | null;
  prevId: string | null;
}

function canonicalize(value: AuditPayload): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Non-finite number encountered in audit payload");
    }
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "undefined") {
    return "null";
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item as AuditPayload)).join(",")}]`;
  }
  if (typeof value === "object") {
    if ("toJSON" in value && typeof (value as any).toJSON === "function") {
      return canonicalize((value as any).toJSON() as AuditPayload);
    }
    const entries = Object.entries(value as Record<string, AuditPayload>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${canonicalize(val)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function putAuditBlob({ orgId, type, payload }: PutAuditBlobInput) {
  const previous = await prisma.auditBlob.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  const prevHash = previous?.hash ?? null;
  const payloadDigest = canonicalize(payload);
  const hash = sha256(`${prevHash ?? ""}${payloadDigest}`);

  const created = await prisma.auditBlob.create({
    data: {
      orgId,
      type,
      payload,
      hash,
      prevHash,
      prevId: previous?.id ?? null,
    },
  });

  return { auditId: created.id, hash, prevHash };
}

interface VerifySuccess {
  valid: true;
  length: number;
}

interface VerifyFailure {
  valid: false;
  reason: string;
  failingAuditId: string;
}

export async function verifyAuditChain(headId: string): Promise<VerifySuccess | VerifyFailure> {
  const visited = new Set<string>();
  let current = await prisma.auditBlob.findUnique({ where: { id: headId } });

  if (!current) {
    return { valid: false, reason: "head_not_found", failingAuditId: headId };
  }

  let length = 0;

  while (current) {
    if (visited.has(current.id)) {
      return { valid: false, reason: "cycle_detected", failingAuditId: current.id };
    }
    visited.add(current.id);
    length += 1;

    const payloadDigest = canonicalize(current.payload as AuditPayload);
    const computedHash = sha256(`${current.prevHash ?? ""}${payloadDigest}`);
    if (computedHash !== current.hash) {
      return { valid: false, reason: "hash_mismatch", failingAuditId: current.id };
    }

    if (!current.prevId) {
      break;
    }

    const prev = await prisma.auditBlob.findUnique({ where: { id: current.prevId } });
    if (!prev) {
      return { valid: false, reason: "missing_prev", failingAuditId: current.id };
    }

    if (prev.hash !== current.prevHash) {
      return { valid: false, reason: "prev_hash_mismatch", failingAuditId: current.id };
    }

    current = prev as unknown as AuditRecord;
  }

  return { valid: true, length };
}
