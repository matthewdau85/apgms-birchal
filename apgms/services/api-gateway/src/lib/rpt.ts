import { createHash, createPublicKey, verify } from "node:crypto";
import { prisma } from "@apgms/shared/db";
import { getSigner } from "./kms.js";

export interface AllocationRecord {
  bucket: string;
  amountCents: number;
  currency: string;
  memo?: string | null;
}

export interface MintRptInput {
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: AllocationRecord[];
  prevHash: string;
  now?: Date;
  keyAlias?: string;
}

export interface MintedRpt {
  id: string;
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: AllocationRecord[];
  prevHash: string;
  timestamp: Date;
  sig: string;
  keyAlias: string;
  keyId: string;
}

interface SignatureEnvelope {
  alias: string;
  keyId: string;
  publicKey: string;
  signature: string;
}

function canonicalAllocations(allocations: AllocationRecord[]): AllocationRecord[] {
  return [...allocations]
    .map((allocation) => ({
      bucket: allocation.bucket,
      amountCents: allocation.amountCents,
      currency: allocation.currency,
      memo: allocation.memo ?? null,
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

function serializePayload(payload: Omit<MintedRpt, "sig" | "keyAlias" | "keyId"> & { timestamp: string }): string {
  return JSON.stringify({
    orgId: payload.orgId,
    bankLineId: payload.bankLineId,
    policyHash: payload.policyHash,
    allocations: canonicalAllocations(payload.allocations),
    prevHash: payload.prevHash,
    timestamp: payload.timestamp,
  });
}

function computeId(payload: string): string {
  const hash = createHash("sha256");
  hash.update(payload);
  return hash.digest("hex");
}

export async function mintRpt(input: MintRptInput): Promise<MintedRpt> {
  const timestampIso = (input.now ?? new Date()).toISOString();
  const keyAlias = input.keyAlias ?? `org-${input.orgId}`;
  const signer = await getSigner(keyAlias);
  if (!signer) {
    throw new Error(`unable_to_load_signer:${keyAlias}`);
  }
  const payloadString = serializePayload({
    orgId: input.orgId,
    bankLineId: input.bankLineId,
    policyHash: input.policyHash,
    allocations: input.allocations,
    prevHash: input.prevHash,
    timestamp: timestampIso,
  });
  const payloadBuffer = Buffer.from(payloadString, "utf8");
  const signature = signer.sign(payloadBuffer).toString("base64");
  const id = computeId(payloadString);
  const envelope: SignatureEnvelope = {
    alias: signer.alias,
    keyId: signer.keyId,
    publicKey: signer.publicKey,
    signature,
  };
  return {
    id,
    orgId: input.orgId,
    bankLineId: input.bankLineId,
    policyHash: input.policyHash,
    allocations: canonicalAllocations(input.allocations),
    prevHash: input.prevHash,
    timestamp: new Date(timestampIso),
    sig: JSON.stringify(envelope),
    keyAlias: signer.alias,
    keyId: signer.keyId,
  };
}

export async function verifyRpt(rpt: {
  id: string;
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: AllocationRecord[];
  prevHash: string;
  timestamp: Date | string;
  sig: string;
}): Promise<boolean> {
  let envelope: SignatureEnvelope;
  try {
    envelope = JSON.parse(rpt.sig) as SignatureEnvelope;
  } catch (error) {
    return false;
  }
  if (!envelope.publicKey || !envelope.signature) {
    return false;
  }
  const timestampIso = typeof rpt.timestamp === "string" ? rpt.timestamp : rpt.timestamp.toISOString();
  const payloadString = serializePayload({
    orgId: rpt.orgId,
    bankLineId: rpt.bankLineId,
    policyHash: rpt.policyHash,
    allocations: rpt.allocations,
    prevHash: rpt.prevHash,
    timestamp: timestampIso,
  });
  const recalculatedId = computeId(payloadString);
  if (recalculatedId !== rpt.id) {
    return false;
  }
  try {
    const publicKey = createPublicKey(envelope.publicKey);
    const verified = verify(null, Buffer.from(payloadString, "utf8"), publicKey, Buffer.from(envelope.signature, "base64"));
    return verified;
  } catch (error) {
    return false;
  }
}

type LoadRptFn = (id: string) => Promise<{
  id: string;
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocationsJson: unknown;
  prevHash: string;
  sig: string;
  timestamp: Date;
} | null>;

function normalizeAllocations(value: unknown): AllocationRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => ({
    bucket: String((item as any).bucket ?? ""),
    amountCents: Number((item as any).amountCents ?? 0),
    currency: String((item as any).currency ?? ""),
    memo: (item as any).memo ?? null,
  }));
}

export async function verifyChain(headRptId: string, options: { loadRpt?: LoadRptFn } = {}): Promise<boolean> {
  const loadRpt: LoadRptFn = options.loadRpt ?? (async (id: string) => prisma.rptToken.findUnique({ where: { id } }));
  const visited = new Set<string>();
  let currentId: string | null = headRptId;
  while (currentId && currentId !== "GENESIS") {
    if (visited.has(currentId)) {
      return false;
    }
    visited.add(currentId);
    const record = await loadRpt(currentId);
    if (!record) {
      return false;
    }
    const normalized = {
      id: record.id,
      orgId: record.orgId,
      bankLineId: record.bankLineId,
      policyHash: record.policyHash,
      allocations: normalizeAllocations((record as any).allocationsJson ?? []),
      prevHash: record.prevHash,
      timestamp: record.timestamp,
      sig: record.sig,
    };
    const valid = await verifyRpt(normalized);
    if (!valid) {
      return false;
    }
    currentId = record.prevHash;
  }
  return true;
}
