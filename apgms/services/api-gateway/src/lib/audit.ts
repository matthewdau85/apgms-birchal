import { randomUUID } from "node:crypto";
import { sha256 } from "../../../../shared/src/crypto";

export interface AuditBlobPayload {
  orgId: string;
  type: string;
  payload: unknown;
  prevHash?: string | null;
}

interface StoredAuditBlob {
  id: string;
  orgId: string;
  type: string;
  payload: unknown;
  prevHash: string | null;
  prevAuditId: string | null;
  hash: string;
  createdAt: Date;
}

interface AppendResult {
  auditId: string;
  hash: string;
  prevHash: string | null;
}

const auditLog = new Map<string, StoredAuditBlob>();
const hashToAuditId = new Map<string, string>();
const orgHead = new Map<string, string>();

function stringifyPayload(payload: unknown): string {
  return JSON.stringify(payload ?? null);
}

function computeHash(prevHash: string | null, payload: unknown): string {
  return sha256(`${prevHash ?? ""}${stringifyPayload(payload)}`);
}

export async function appendAuditBlob({ orgId, type, payload, prevHash }: AuditBlobPayload): Promise<AppendResult> {
  const normalizedPrevHash = prevHash ?? null;
  let prevAuditId: string | null = null;

  if (normalizedPrevHash) {
    prevAuditId = hashToAuditId.get(normalizedPrevHash) ?? null;
    if (!prevAuditId) {
      throw new Error(`Unknown prevHash: ${normalizedPrevHash}`);
    }
  } else {
    const orgHeadId = orgHead.get(orgId) ?? null;
    if (orgHeadId) {
      prevAuditId = orgHeadId;
    }
  }

  const resolvedPrevHash = normalizedPrevHash ?? (prevAuditId ? auditLog.get(prevAuditId)?.hash ?? null : null);
  const hash = computeHash(resolvedPrevHash, payload);
  const auditId = randomUUID();
  const record: StoredAuditBlob = {
    id: auditId,
    orgId,
    type,
    payload,
    prevHash: resolvedPrevHash,
    prevAuditId,
    hash,
    createdAt: new Date(),
  };

  auditLog.set(auditId, record);
  hashToAuditId.set(hash, auditId);
  orgHead.set(orgId, auditId);

  return { auditId, hash, prevHash: resolvedPrevHash };
}

export async function verifyAuditChain(headAuditId: string): Promise<boolean> {
  const visited = new Set<string>();
  let currentId: string | null = headAuditId;

  while (currentId) {
    if (visited.has(currentId)) {
      return false;
    }
    visited.add(currentId);

    const current = auditLog.get(currentId);
    if (!current) {
      return false;
    }

    const expectedHash = computeHash(current.prevHash, current.payload);
    if (expectedHash !== current.hash) {
      return false;
    }

    if (current.prevAuditId) {
      const prevRecord = auditLog.get(current.prevAuditId);
      if (!prevRecord) {
        return false;
      }
      if (prevRecord.hash !== current.prevHash) {
        return false;
      }
      currentId = current.prevAuditId;
    } else {
      if (current.prevHash !== null) {
        return false;
      }
      currentId = null;
    }
  }

  return true;
}

export function getAuditBlob(auditId: string): StoredAuditBlob | undefined {
  return auditLog.get(auditId);
}

export function getOrgHead(orgId: string): string | undefined {
  return orgHead.get(orgId);
}
