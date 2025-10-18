import { createHash, generateKeyPairSync, KeyObject, randomUUID, sign, verify } from "node:crypto";

import type { Allocation } from "@apgms/policy-engine";

export interface RPTPayload {
  bankLineId: string;
  policyHash: string;
  allocations: Allocation[];
  prevHash: string | null;
  timestamp: string;
}

export interface RPT extends RPTPayload {
  id: string;
  hash: string;
  sig: string;
}

export interface VerificationResult {
  ok: boolean;
  hash: string;
  validSignature: boolean;
  validChain: boolean;
  chainDepth: number;
  rpt: RPT;
}

export interface KMSAbstraction {
  sign(data: Uint8Array): Promise<Uint8Array>;
  verify(data: Uint8Array, signature: Uint8Array): Promise<boolean>;
  exportPublicKey(): Promise<string>;
}

class DevKMS implements KMSAbstraction {
  #privateKey: KeyObject;
  #publicKey: KeyObject;

  constructor() {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    this.#privateKey = privateKey;
    this.#publicKey = publicKey;
  }

  async sign(data: Uint8Array): Promise<Uint8Array> {
    return sign(null, data, this.#privateKey);
  }

  async verify(data: Uint8Array, signature: Uint8Array): Promise<boolean> {
    return verify(null, data, this.#publicKey, signature);
  }

  async exportPublicKey(): Promise<string> {
    return this.#publicKey.export({ type: "spki", format: "pem" }).toString();
  }
}

const defaultKms = new DevKMS();

const rptStore = new Map<string, RPT>();
const rptHashIndex = new Map<string, string>();

export async function mintRPT(
  params: Omit<RPTPayload, "timestamp" | "prevHash"> & { prevHash?: string | null; timestamp?: string },
  kms: KMSAbstraction = defaultKms,
): Promise<RPT> {
  const timestamp = params.timestamp ?? new Date().toISOString();
  const prevHash = params.prevHash ?? null;
  const allocations = canonicalizeAllocations(params.allocations);

  const payload: RPTPayload = {
    bankLineId: params.bankLineId,
    policyHash: params.policyHash,
    allocations,
    prevHash,
    timestamp,
  };

  const message = encodePayload(payload);
  const hash = createHash("sha256").update(message).digest("hex");
  const signature = await kms.sign(message);
  const sig = Buffer.from(signature).toString("base64");

  const rpt: RPT = {
    id: randomUUID(),
    ...payload,
    hash,
    sig,
  };

  rptStore.set(rpt.id, rpt);
  rptHashIndex.set(hash, rpt.id);

  return rpt;
}

export function getRPT(id: string): RPT | undefined {
  return rptStore.get(id);
}

export function listRPTs(): RPT[] {
  return Array.from(rptStore.values());
}

export function resetRPTStore(): void {
  rptStore.clear();
  rptHashIndex.clear();
}

export async function verifyStoredRPT(
  id: string,
  kms: KMSAbstraction = defaultKms,
): Promise<VerificationResult | { ok: false; error: "not_found" } | { ok: false; error: "invalid"; reason: string }> {
  const rpt = rptStore.get(id);
  if (!rpt) {
    return { ok: false, error: "not_found" } as const;
  }

  const message = encodePayload(rpt);
  const computedHash = createHash("sha256").update(message).digest("hex");
  if (computedHash !== rpt.hash) {
    return { ok: false, error: "invalid", reason: "hash" } as const;
  }

  const signatureBytes = Buffer.from(rpt.sig, "base64");
  const validSignature = await kms.verify(message, signatureBytes);

  const { valid: validChain, depth } = await verifyChain(rpt, kms, new Set<string>());

  if (!validSignature || !validChain) {
    return {
      ok: false,
      error: "invalid",
      reason: !validSignature ? "signature" : "chain",
    } as const;
  }

  return {
    ok: true,
    hash: rpt.hash,
    validSignature,
    validChain,
    chainDepth: depth,
    rpt,
  };
}

async function verifyChain(
  rpt: RPT,
  kms: KMSAbstraction,
  visited: Set<string>,
): Promise<{ valid: boolean; depth: number }> {
  if (visited.has(rpt.hash)) {
    return { valid: false, depth: visited.size };
  }
  visited.add(rpt.hash);

  if (!rpt.prevHash) {
    return { valid: true, depth: visited.size };
  }

  const prevId = rptHashIndex.get(rpt.prevHash);
  if (!prevId) {
    return { valid: false, depth: visited.size };
  }
  const prevRpt = rptStore.get(prevId);
  if (!prevRpt) {
    return { valid: false, depth: visited.size };
  }

  const prevMessage = encodePayload(prevRpt);
  const prevHash = createHash("sha256").update(prevMessage).digest("hex");
  if (prevHash !== prevRpt.hash) {
    return { valid: false, depth: visited.size };
  }
  const prevSig = Buffer.from(prevRpt.sig, "base64");
  const signatureValid = await kms.verify(prevMessage, prevSig);
  if (!signatureValid) {
    return { valid: false, depth: visited.size };
  }

  return verifyChain(prevRpt, kms, visited);
}

function encodePayload(payload: RPTPayload | RPT): Uint8Array {
  const snapshot = canonicalizeObject({
    bankLineId: payload.bankLineId,
    policyHash: payload.policyHash,
    allocations: canonicalizeAllocations(payload.allocations),
    prevHash: payload.prevHash ?? null,
    timestamp: payload.timestamp,
  });
  return Buffer.from(JSON.stringify(snapshot));
}

function canonicalizeAllocations(allocations: Allocation[]): Allocation[] {
  return allocations
    .map((allocation) => ({
      accountId: allocation.accountId,
      amount: allocation.amount,
      ruleId: allocation.ruleId,
    }))
    .sort((a, b) => {
      if (a.accountId === b.accountId) {
        return a.ruleId.localeCompare(b.ruleId);
      }
      return a.accountId.localeCompare(b.accountId);
    });
}

function canonicalizeObject(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeObject(entry));
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => [key, canonicalizeObject(val)] as const);
  return Object.fromEntries(entries);
}

export const KMS_ABSTRACTION: KMSAbstraction = defaultKms;
