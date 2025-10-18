import { createHash, randomUUID, verify as verifySignature, createPublicKey } from "node:crypto";
import type { Allocation } from "@apgms/shared/policy-engine";
import { pubkey, sign } from "./kmsLike";

export interface RptTokenPayload {
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: Allocation[];
  prevHash: string | null;
  issuedAt: string;
}

export interface RptToken {
  id: string;
  hash: string;
  signature: string;
  publicKey: string;
  payload: RptTokenPayload;
}

export interface RptVerificationResult {
  valid: boolean;
  reason?: string;
  expectedHash?: string;
}

export interface RptChainVerificationResult {
  valid: boolean;
  reason?: string;
  failedId?: string;
  depth: number;
}

const encoder = new TextEncoder();

function canonicalizeAllocation(allocation: Allocation): Allocation {
  return {
    accountId: allocation.accountId,
    amount: Number(allocation.amount),
  };
}

function sortAllocations(allocations: Allocation[]): Allocation[] {
  return [...allocations].sort((a, b) => {
    if (a.accountId === b.accountId) {
      return a.amount - b.amount;
    }
    return a.accountId.localeCompare(b.accountId);
  });
}

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${canonicalStringify(val)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function payloadToCanonical(payload: RptTokenPayload): string {
  const normalized: RptTokenPayload = {
    ...payload,
    allocations: sortAllocations(payload.allocations.map(canonicalizeAllocation)),
    prevHash: payload.prevHash ?? null,
  };
  return canonicalStringify(normalized);
}

export function mintRpt(input: {
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: Allocation[];
  prevHash: string | null;
  now: Date;
}): RptToken {
  const issuedAt = input.now.toISOString();
  const payload: RptTokenPayload = {
    orgId: input.orgId,
    bankLineId: input.bankLineId,
    policyHash: input.policyHash,
    allocations: sortAllocations(input.allocations.map(canonicalizeAllocation)),
    prevHash: input.prevHash,
    issuedAt,
  };
  const canonical = payloadToCanonical(payload);
  const bytes = encoder.encode(canonical);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const signature = sign(bytes);
  return {
    id: randomUUID(),
    hash,
    signature,
    publicKey: pubkey(),
    payload,
  };
}

function verifySignatureWithPublicKey(publicKeyBase64: string, bytes: Uint8Array, signature: string): boolean {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, "base64"),
      format: "der",
      type: "spki",
    });
    return verifySignature(null, bytes, publicKey, Buffer.from(signature, "base64"));
  } catch (error) {
    return false;
  }
}

export function verifyRpt(token: RptToken): RptVerificationResult {
  const canonical = payloadToCanonical(token.payload);
  const bytes = encoder.encode(canonical);
  const expectedHash = createHash("sha256").update(bytes).digest("hex");
  if (expectedHash !== token.hash) {
    return { valid: false, reason: "hash_mismatch", expectedHash };
  }

  const signatureValid = verifySignatureWithPublicKey(token.publicKey, bytes, token.signature);
  if (!signatureValid) {
    return { valid: false, reason: "signature_invalid" };
  }

  return { valid: true };
}

type StoredToken = {
  token: RptToken;
  createdAt: Date;
};

type LedgerEntryRecord = {
  id: string;
  orgId: string;
  bankLineId: string;
  rptTokenId: string;
  accountId: string;
  amount: number;
  createdAt: Date;
};

const tokenStore = new Map<string, StoredToken>();
const hashIndex = new Map<string, string>();
const orgIndex = new Map<string, string[]>();
const ledgerEntries = new Map<string, LedgerEntryRecord[]>();

function indexToken(token: RptToken) {
  const createdAt = new Date(token.payload.issuedAt);
  tokenStore.set(token.id, { token, createdAt });
  hashIndex.set(token.hash, token.id);
  const orgTokens = orgIndex.get(token.payload.orgId) ?? [];
  orgTokens.push(token.id);
  orgIndex.set(token.payload.orgId, orgTokens);
  const entries = ledgerEntries.get(token.id) ?? [];
  entries.push(
    ...token.payload.allocations.map((allocation) => ({
      id: randomUUID(),
      orgId: token.payload.orgId,
      bankLineId: token.payload.bankLineId,
      rptTokenId: token.id,
      accountId: allocation.accountId,
      amount: Number(allocation.amount),
      createdAt,
    })),
  );
  ledgerEntries.set(token.id, entries);
}

export async function saveRptToken(_: unknown, token: RptToken): Promise<void> {
  indexToken(token);
}

export async function fetchRptTokenById(_: unknown, id: string): Promise<RptToken | null> {
  const stored = tokenStore.get(id);
  return stored ? stored.token : null;
}

export async function fetchRptTokenByHash(_: unknown, hash: string): Promise<RptToken | null> {
  const tokenId = hashIndex.get(hash);
  if (!tokenId) return null;
  const stored = tokenStore.get(tokenId);
  return stored ? stored.token : null;
}

export async function fetchLatestRptTokenForOrg(_: unknown, orgId: string): Promise<RptToken | null> {
  const ids = orgIndex.get(orgId);
  if (!ids || ids.length === 0) return null;
  const lastId = ids[ids.length - 1];
  const stored = tokenStore.get(lastId);
  return stored ? stored.token : null;
}

export async function verifyChain(_: unknown, headRptId: string): Promise<RptChainVerificationResult> {
  let currentId: string | null = headRptId;
  let depth = 0;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      return { valid: false, reason: "cycle_detected", failedId: currentId, depth };
    }
    visited.add(currentId);

    const stored = tokenStore.get(currentId);
    if (!stored) {
      return { valid: false, reason: "token_missing", failedId: currentId, depth };
    }

    const verification = verifyRpt(stored.token);
    if (!verification.valid) {
      return { valid: false, reason: verification.reason ?? "verify_failed", failedId: currentId, depth };
    }

    depth += 1;

    if (stored.token.payload.prevHash) {
      const prev = await fetchRptTokenByHash(null, stored.token.payload.prevHash);
      if (!prev) {
        return { valid: false, reason: "prev_missing", failedId: stored.token.id, depth };
      }
      currentId = prev.id;
    } else {
      currentId = null;
    }
  }

  return { valid: true, depth };
}

export function clearRptStore() {
  tokenStore.clear();
  hashIndex.clear();
  orgIndex.clear();
  ledgerEntries.clear();
}
