import { randomUUID, createHash, sign, verify, createPrivateKey, createPublicKey } from "node:crypto";

const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIPleqpz3Uaxew5FyiFSlljUXI7FeB+FxFidR6+Aj8m2v\n-----END PRIVATE KEY-----`;
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAiXdSvgAIE1hixflwsxrlOF9mVBuJ3k2d1LtYG7gHJFo=\n-----END PUBLIC KEY-----`;

const signerKey = createPrivateKey(PRIVATE_KEY_PEM);
const verifierKey = createPublicKey(PUBLIC_KEY_PEM);

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface Allocation {
  accountId: string;
  amount: number;
  currency?: string;
}

export interface MintRptArgs {
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: Allocation[];
  prevHash?: string | null;
  now: Date;
}

export interface RptPayloadBase {
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: Allocation[];
  prevHash: string | null;
  timestamp: string;
}

export interface RptPayload extends RptPayloadBase {
  hash: string;
}

export interface RptRecord {
  rptId: string;
  payload: RptPayload;
  sig: string;
}

const rptById = new Map<string, RptRecord>();
const rptIdByHash = new Map<string, string>();
const latestRptByLine = new Map<string, RptRecord>();

function canonicalize(input: JsonValue): string {
  if (input === null) {
    return "null";
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new Error("Non-finite numbers are not supported");
    }
    return input.toString();
  }
  if (typeof input === "boolean") {
    return input ? "true" : "false";
  }
  if (typeof input === "string") {
    return JSON.stringify(input);
  }
  if (Array.isArray(input)) {
    return `[${input.map((item) => canonicalize(item as JsonValue)).join(",")}]`;
  }
  const keys = Object.keys(input).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalize((input as Record<string, JsonValue>)[key])}`);
  return `{${entries.join(",")}}`;
}

function canonicalHash(payload: RptPayloadBase): string {
  const canonicalJson = canonicalize(payload as unknown as JsonValue);
  return createHash("sha256").update(canonicalJson).digest("base64");
}

function storeRpt(record: RptRecord) {
  rptById.set(record.rptId, record);
  rptIdByHash.set(record.payload.hash, record.rptId);
  const currentLatest = latestRptByLine.get(record.payload.bankLineId);
  if (!currentLatest || currentLatest.payload.timestamp < record.payload.timestamp) {
    latestRptByLine.set(record.payload.bankLineId, record);
  }
}

export function resetRptStore() {
  rptById.clear();
  rptIdByHash.clear();
  latestRptByLine.clear();
}

export function getRptById(rptId: string) {
  return rptById.get(rptId);
}

export function getLatestRptByBankLineId(bankLineId: string) {
  return latestRptByLine.get(bankLineId);
}

export function mintRpt({ orgId, bankLineId, policyHash, allocations, prevHash = null, now }: MintRptArgs): RptRecord {
  const timestamp = now.toISOString();
  const rptId = randomUUID();
  const sanitizedAllocations = allocations.map((alloc) => {
    const cloned: Allocation = {
      accountId: alloc.accountId,
      amount: alloc.amount,
    };
    if (alloc.currency !== undefined) {
      cloned.currency = alloc.currency;
    }
    return cloned;
  });
  const payloadBase: RptPayloadBase = {
    orgId,
    bankLineId,
    policyHash,
    allocations: sanitizedAllocations,
    prevHash,
    timestamp,
  };
  const hash = canonicalHash(payloadBase);
  const signature = sign(null, Buffer.from(hash, "base64"), signerKey).toString("base64");

  const record: RptRecord = {
    rptId,
    payload: { ...payloadBase, hash },
    sig: signature,
  };

  storeRpt(record);
  return record;
}

export function verifyRpt(record: RptRecord): boolean {
  try {
    const { payload, sig } = record;
    const { hash, ...rest } = payload;
    const recalculatedHash = canonicalHash(rest);
    if (recalculatedHash !== hash) {
      return false;
    }
    const signature = Buffer.from(sig, "base64");
    const hashedPayload = Buffer.from(hash, "base64");
    return verify(null, hashedPayload, verifierKey, signature);
  } catch (err) {
    return false;
  }
}

export function verifyChain(headRptId: string): { valid: boolean; brokenAt?: string } {
  const visited = new Set<string>();
  let currentId: string | undefined = headRptId;

  while (currentId) {
    if (visited.has(currentId)) {
      return { valid: false, brokenAt: currentId };
    }
    visited.add(currentId);

    const current = rptById.get(currentId);
    if (!current) {
      return { valid: false, brokenAt: currentId };
    }
    if (!verifyRpt(current)) {
      return { valid: false, brokenAt: currentId };
    }

    const prevHash = current.payload.prevHash;
    if (!prevHash) {
      return { valid: true };
    }

    const prevId = rptIdByHash.get(prevHash);
    if (!prevId) {
      return { valid: false, brokenAt: currentId };
    }

    currentId = prevId;
  }

  return { valid: true };
}
