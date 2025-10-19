import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign as signMessage,
  verify as verifySignature,
} from "node:crypto";
import { TextEncoder } from "node:util";
import {
  allocationsRequestSchema,
  type Allocation,
  type AllocationsRequest,
} from "./schemas/allocations";
import { rptPayloadSchema, rptTokenSchema, type RptPayload, type RptToken } from "./schemas/rpt";

const encoder = new TextEncoder();

interface MintRptArgs extends AllocationsRequest {}

export interface LedgerEntry {
  orgId: string;
  bankLineId: string;
  accountId: string;
  amount: number;
  memo?: string;
  policyHash: string;
  rptHash: string;
  timestamp: string;
}

const kmsKeyPair = createKeyPair();
const rptStore = new Map<string, RptToken>();
const ledgerStore = new Map<string, LedgerEntry[]>();

function createKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  return { publicKey, privateKey, publicKeyDer: Buffer.from(publicKeyDer) };
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries
      .map(([key, val]) => `${JSON.stringify(key)}:${canonicalize(val)}`)
      .join(",")}}`;
  }
  throw new TypeError(`Unsupported value in canonicalizer: ${typeof value}`);
}

function hashCanonicalPayload(canonicalPayload: string): string {
  return createHash("sha256").update(canonicalPayload).digest("hex");
}

function normalizeAllocationsRequest(args: MintRptArgs): RptPayload {
  const parsed = allocationsRequestSchema.parse(args);
  return rptPayloadSchema.parse(parsed);
}

function encodeCanonicalPayload(payload: RptPayload): { canonical: string; bytes: Uint8Array } {
  const canonical = canonicalize(payload);
  return { canonical, bytes: encoder.encode(canonical) };
}

function encodeBase64(data: Uint8Array | Buffer): string {
  return Buffer.from(data).toString("base64");
}

function decodeBase64(data: string): Buffer {
  return Buffer.from(data, "base64");
}

export async function mintRpt(args: MintRptArgs): Promise<RptToken> {
  const payload = normalizeAllocationsRequest({ ...args, now: args.now ?? new Date().toISOString() });
  const { canonical, bytes } = encodeCanonicalPayload(payload);
  const signature = signMessage(null, bytes, kmsKeyPair.privateKey);
  const hash = hashCanonicalPayload(canonical);

  const token: RptToken = {
    hash,
    payload,
    signature: encodeBase64(signature),
    publicKey: encodeBase64(kmsKeyPair.publicKeyDer),
  };

  return token;
}

export function deriveLedgerEntries(payload: RptPayload, rptHash: string): LedgerEntry[] {
  return payload.allocations.map((allocation) => mapToLedgerEntry(payload, allocation, rptHash));
}

function mapToLedgerEntry(payload: RptPayload, allocation: Allocation, rptHash: string): LedgerEntry {
  return {
    orgId: payload.orgId,
    bankLineId: payload.bankLineId,
    accountId: allocation.accountId,
    amount: allocation.amount,
    memo: allocation.memo,
    policyHash: payload.policyHash,
    rptHash,
    timestamp: payload.now,
  };
}

export function storeRptToken(token: RptToken, ledgerEntries: LedgerEntry[]): void {
  rptStore.set(token.hash, rptTokenSchema.parse(token));
  ledgerStore.set(token.hash, ledgerEntries);
}

export function getStoredRpt(hash: string): RptToken | undefined {
  return rptStore.get(hash);
}

export function getStoredLedger(hash: string): LedgerEntry[] | undefined {
  return ledgerStore.get(hash);
}

export function resetRptState(): void {
  rptStore.clear();
  ledgerStore.clear();
}

export async function verifyRpt(token: RptToken): Promise<boolean> {
  try {
    const parsed = rptTokenSchema.parse(token);
    const { canonical, bytes } = encodeCanonicalPayload(parsed.payload);
    const expectedHash = hashCanonicalPayload(canonical);
    if (expectedHash !== parsed.hash) {
      return false;
    }
    const publicKey = createPublicKey({ key: decodeBase64(parsed.publicKey), format: "der", type: "spki" });
    const signature = decodeBase64(parsed.signature);
    return verifySignature(null, bytes, publicKey, signature);
  } catch {
    return false;
  }
}

export async function verifyChain(headHash: string): Promise<boolean> {
  const visited = new Set<string>();
  let currentHash: string | null = headHash;

  while (currentHash) {
    if (visited.has(currentHash)) {
      return false;
    }
    visited.add(currentHash);

    const currentToken = rptStore.get(currentHash);
    if (!currentToken) {
      return false;
    }

    const valid = await verifyRpt(currentToken);
    if (!valid) {
      return false;
    }

    currentHash = currentToken.payload.prevHash;
  }

  return true;
}
