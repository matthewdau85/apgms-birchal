import { createHash } from "node:crypto";
import { verify as nobleVerify, getPublicKey } from "@noble/ed25519";

export type RptAllocation = Record<string, unknown>;

export interface RptBase {
  rptId: string;
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: RptAllocation[];
  prevHash?: string | null;
  now: string | Date | number;
}

export interface SignedRpt extends Omit<RptBase, "now"> {
  now: string;
  hash: string;
  sig: string;
}

export interface MintRptParams extends Omit<RptBase, "now"> {
  now: Date | string | number;
}

export interface KmsSigner {
  sign(data: Uint8Array): Promise<Uint8Array> | Uint8Array;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const canonicalize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (isObject(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("non_finite_number");
    }
    return value.toString(10);
  }
  if (typeof value === "bigint") {
    return value.toString(10);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (value === null || value === undefined) {
    return "null";
  }
  throw new Error("unsupported_type");
};

export const canonicalAlloc = (allocation: RptAllocation): string => canonicalize(allocation);

const normalizeNow = (value: Date | string | number): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("invalid_date");
  }
  return parsed.toISOString();
};

const toHashPayload = (rpt: RptBase | SignedRpt): Omit<SignedRpt, "hash" | "sig"> => ({
  rptId: rpt.rptId,
  orgId: rpt.orgId,
  bankLineId: rpt.bankLineId,
  policyHash: rpt.policyHash,
  allocations: rpt.allocations,
  prevHash: rpt.prevHash ?? null,
  now: normalizeNow(rpt.now),
});

const toSortedCanonicalAllocations = (allocations: RptAllocation[]): string[] =>
  allocations.map((allocation) => canonicalAlloc(allocation)).sort();

export const hashRpt = (rpt: RptBase | SignedRpt): string => {
  const base = toHashPayload(rpt);
  const canonicalPayload = {
    ...base,
    allocations: toSortedCanonicalAllocations(base.allocations),
  };
  const canonical = canonicalize(canonicalPayload);
  return createHash("sha256").update(canonical).digest("hex");
};

const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0) {
    throw new Error("invalid_hex");
  }
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = Number.parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("invalid_hex");
    }
    result[i / 2] = byte;
  }
  return result;
};

const normalizeKey = (input: Uint8Array | string): Uint8Array => {
  if (typeof input === "string") {
    const trimmed = input.trim();
    const isHex = /^[0-9a-f]+$/i.test(trimmed) && trimmed.length >= 64 && trimmed.length % 2 === 0;
    if (isHex) {
      return hexToBytes(trimmed.toLowerCase());
    }
    return Uint8Array.from(Buffer.from(trimmed, "base64"));
  }
  return input;
};

const decodeSignature = (sig: string): Uint8Array => Uint8Array.from(Buffer.from(sig, "base64"));

export const mintRpt = async (
  { rptId, orgId, bankLineId, policyHash, allocations, prevHash, now }: MintRptParams,
  kms: KmsSigner,
): Promise<SignedRpt> => {
  const normalizedNow = normalizeNow(now);
  const base: Omit<SignedRpt, "hash" | "sig"> = {
    rptId,
    orgId,
    bankLineId,
    policyHash,
    allocations: allocations.map((allocation) => ({ ...allocation })),
    prevHash: prevHash ?? null,
    now: normalizedNow,
  };

  const hash = hashRpt(base);
  const message = hexToBytes(hash);
  const signatureBytes = await kms.sign(message);
  const sig = Buffer.from(signatureBytes).toString("base64");

  return {
    ...base,
    hash,
    sig,
  };
};

export const verifyRpt = async (rpt: SignedRpt, pubkey: Uint8Array | string): Promise<boolean> => {
  try {
    const expectedHash = hashRpt(rpt);
    if (expectedHash !== rpt.hash) {
      return false;
    }
    const publicKeyBytes = normalizeKey(pubkey);
    const signatureBytes = decodeSignature(rpt.sig);
    return await nobleVerify(signatureBytes, hexToBytes(rpt.hash), publicKeyBytes);
  } catch {
    return false;
  }
};

export const verifyChain = async (
  headRptId: string,
  loadPrev: (idOrHash: string) => Promise<SignedRpt | null | undefined>,
): Promise<boolean> => {
  let current = await loadPrev(headRptId);
  if (!current) {
    return false;
  }
  const visited = new Set<string>();

  while (current) {
    const recalculated = hashRpt(current);
    if (recalculated !== current.hash) {
      return false;
    }
    if (visited.has(current.hash)) {
      return false;
    }
    visited.add(current.hash);

    if (!current.prevHash) {
      return true;
    }

    const previous = await loadPrev(current.prevHash);
    if (!previous) {
      return false;
    }
    if (previous.hash !== current.prevHash) {
      return false;
    }
    current = previous;
  }

  return false;
};

export const derivePublicKey = async (secretKey: Uint8Array): Promise<Uint8Array> => getPublicKey(secretKey);
