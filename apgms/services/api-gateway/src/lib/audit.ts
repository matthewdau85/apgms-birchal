import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "../../../../shared/src/db";

export interface AppendAuditBlobArgs {
  orgId: string;
  type: string;
  payload: Prisma.JsonValue;
  prevHash?: string | null;
}

export interface AppendAuditBlobResult {
  auditId: string;
  hash: string;
  prevHash: string | null;
}

function computeHash(prevHash: string | null, payload: Prisma.JsonValue): string {
  const payloadString = JSON.stringify(payload);
  const input = `${prevHash ?? ""}${payloadString}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function appendAuditBlob({
  orgId,
  type,
  payload,
  prevHash,
}: AppendAuditBlobArgs): Promise<AppendAuditBlobResult> {
  const normalizedPrevHash = prevHash ?? null;
  const hash = computeHash(normalizedPrevHash, payload);

  const created = await prisma.auditBlob.create({
    data: {
      orgId,
      type,
      payload,
      hash,
      prevHash: normalizedPrevHash,
    },
  });

  return {
    auditId: created.id,
    hash: created.hash,
    prevHash: created.prevHash ?? null,
  };
}

export async function verifyAuditChain(headAuditId: string): Promise<boolean> {
  let current = await prisma.auditBlob.findUnique({
    where: { id: headAuditId },
  });

  if (!current) {
    return false;
  }

  while (current) {
    const expectedHash = computeHash(current.prevHash ?? null, current.payload);

    if (expectedHash !== current.hash) {
      return false;
    }

    if (!current.prevHash) {
      break;
    }

    current = await prisma.auditBlob.findUnique({
      where: { hash: current.prevHash },
    });

    if (!current) {
      return false;
    }
  }

  return true;
}
