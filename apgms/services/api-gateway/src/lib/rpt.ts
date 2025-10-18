import { createHash, randomUUID } from "node:crypto";
import { kmsLike } from "./kmsLike.js";

export type RptAllocation = {
  allocationId: string;
  amountCents: number;
  memo?: string;
};

export type RptToken = {
  rptId: string;
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: RptAllocation[];
  prevHash: string | null;
  sig: string;
  timestamp: string;
};

export type MintRptInput = {
  rptId: string;
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: RptAllocation[];
  prevHash?: string | null;
  timestamp?: string;
};

export type MintedRpt = {
  token: RptToken;
  hash: string;
  canonical: string;
};

export type VerifyRptResult = {
  ok: boolean;
  hash: string;
  canonical: string;
  reason?: string;
};

export type VerifyChainSuccess = {
  ok: true;
  verified: true;
  length: number;
  headHash: string;
};

export type VerifyChainFailure = {
  ok: false;
  verified: false;
  reason: string;
  rptId: string;
  details?: Record<string, unknown>;
};

export type VerifyChainResult = VerifyChainSuccess | VerifyChainFailure;

export type LedgerEntry = {
  id: string;
  rptId: string;
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: RptAllocation[];
  prevHash: string | null;
  createdAt: string;
};

const rptTokensById = new Map<string, MintedRpt>();
const rptIdsByHash = new Map<string, string>();
const latestRptByOrg = new Map<string, string>();
const ledgerEntries = new Map<string, LedgerEntry>();

const normalizeStructuredData = (input: unknown): unknown => {
  if (Array.isArray(input)) {
    return input.map((value) => normalizeStructuredData(value));
  }
  if (input && typeof input === "object" && Object.getPrototypeOf(input) === Object.prototype) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      result[key] = normalizeStructuredData((input as Record<string, unknown>)[key]);
    }
    return result;
  }
  return input;
};

export const canonicalize = (value: unknown): string => {
  return JSON.stringify(normalizeStructuredData(value));
};

export const hashCanonical = (value: unknown): { canonical: string; hash: string } => {
  const canonical = canonicalize(value);
  const digest = createHash("sha256").update(canonical).digest("hex");
  return { canonical, hash: digest };
};

const cloneAllocations = (allocations: RptAllocation[]): RptAllocation[] => {
  return allocations.map((allocation) => ({ ...allocation }));
};

const buildRptPayload = (input: MintRptInput, timestamp: string, prevHash: string | null) => {
  return {
    rptId: input.rptId,
    orgId: input.orgId,
    bankLineId: input.bankLineId,
    policyHash: input.policyHash,
    allocations: cloneAllocations(input.allocations),
    prevHash,
    timestamp,
  };
};

export const mintRpt = (input: MintRptInput): MintedRpt => {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const prevHash = input.prevHash ?? null;
  const payload = buildRptPayload(input, timestamp, prevHash);
  const canonical = canonicalize(payload);
  const digest = createHash("sha256").update(canonical).digest();
  const hash = digest.toString("hex");
  const sig = kmsLike.sign(digest);
  const token: RptToken = {
    ...payload,
    sig,
  };
  return { token, hash, canonical };
};

export const verifyRpt = (token: RptToken): VerifyRptResult => {
  const payload = {
    rptId: token.rptId,
    orgId: token.orgId,
    bankLineId: token.bankLineId,
    policyHash: token.policyHash,
    allocations: cloneAllocations(token.allocations),
    prevHash: token.prevHash ?? null,
    timestamp: token.timestamp,
  };
  const canonical = canonicalize(payload);
  const digest = createHash("sha256").update(canonical).digest();
  const hash = digest.toString("hex");
  const ok = kmsLike.verify(digest, token.sig);
  if (!ok) {
    return { ok: false, reason: "invalid_signature", hash, canonical };
  }
  return { ok: true, hash, canonical };
};

export const persistRpt = (minted: MintedRpt): MintedRpt => {
  const stored = {
    token: {
      ...minted.token,
      allocations: cloneAllocations(minted.token.allocations),
      prevHash: minted.token.prevHash ?? null,
    },
    hash: minted.hash,
    canonical: minted.canonical,
  };
  rptTokensById.set(stored.token.rptId, stored);
  rptIdsByHash.set(stored.hash, stored.token.rptId);
  latestRptByOrg.set(stored.token.orgId, stored.token.rptId);
  return stored;
};

export const getRpt = (rptId: string): MintedRpt | undefined => {
  return rptTokensById.get(rptId);
};

export const getRptByHash = (hash: string): MintedRpt | undefined => {
  const rptId = rptIdsByHash.get(hash);
  return rptId ? rptTokensById.get(rptId) : undefined;
};

export const getLatestRptForOrg = (orgId: string): MintedRpt | undefined => {
  const rptId = latestRptByOrg.get(orgId);
  return rptId ? rptTokensById.get(rptId) : undefined;
};

export const persistLedgerEntry = (entry: Omit<LedgerEntry, "id"> & { id?: string }): LedgerEntry => {
  const id = entry.id ?? randomUUID();
  const stored: LedgerEntry = {
    id,
    rptId: entry.rptId,
    orgId: entry.orgId,
    bankLineId: entry.bankLineId,
    policyHash: entry.policyHash,
    allocations: cloneAllocations(entry.allocations),
    prevHash: entry.prevHash ?? null,
    createdAt: entry.createdAt,
  };
  ledgerEntries.set(id, stored);
  return stored;
};

export const listLedgerEntries = (): LedgerEntry[] => Array.from(ledgerEntries.values());

export const verifyChain = (headRptId: string): VerifyChainResult => {
  const visited = new Set<string>();
  let currentId: string | undefined = headRptId;
  let expectedHash: string | null = null;
  let childId: string | null = null;
  let steps = 0;

  while (currentId) {
    if (visited.has(currentId)) {
      return {
        ok: false,
        verified: false,
        reason: "cycle_detected",
        rptId: currentId,
      };
    }
    visited.add(currentId);
    const record = rptTokensById.get(currentId);
    if (!record) {
      return {
        ok: false,
        verified: false,
        reason: "missing_token",
        rptId: childId ?? currentId,
      };
    }

    const verification = verifyRpt(record.token);
    if (!verification.ok) {
      return {
        ok: false,
        verified: false,
        reason: verification.reason ?? "invalid_signature",
        rptId: currentId,
      };
    }

    if (expectedHash && verification.hash !== expectedHash) {
      return {
        ok: false,
        verified: false,
        reason: "prev_hash_mismatch",
        rptId: childId ?? currentId,
        details: { expectedHash, actualHash: verification.hash },
      };
    }

    steps += 1;

    const prevHash = record.token.prevHash;
    if (!prevHash) {
      return {
        ok: true,
        verified: true,
        length: steps,
        headHash: verification.hash,
      };
    }

    const prevId = rptIdsByHash.get(prevHash);
    if (!prevId) {
      return {
        ok: false,
        verified: false,
        reason: "prev_hash_not_found",
        rptId: record.token.rptId,
        details: { missingHash: prevHash },
      };
    }

    expectedHash = prevHash;
    childId = record.token.rptId;
    currentId = prevId;
  }

  return {
    ok: false,
    verified: false,
    reason: "chain_incomplete",
    rptId: headRptId,
  };
};

export const resetRptStore = (): void => {
  rptTokensById.clear();
  rptIdsByHash.clear();
  latestRptByOrg.clear();
  ledgerEntries.clear();
};
