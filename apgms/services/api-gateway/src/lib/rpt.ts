import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  randomUUID,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";

import type { Allocation } from "shared/policy-engine/index.js";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",")}}`;
}

export interface KmsLike {
  sign(message: Uint8Array): Promise<{ signature: string; publicKey: string }>;
}

class Ed25519Kms implements KmsLike {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;

  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  async sign(message: Uint8Array): Promise<{ signature: string; publicKey: string }> {
    const signature = sign(null, message, this.privateKey).toString("base64");
    const publicKey = this.publicKey
      .export({ type: "spki", format: "pem" })
      .toString();
    return { signature, publicKey };
  }
}

const defaultKms = new Ed25519Kms();

export interface RptToken {
  rptId: string;
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: Allocation[];
  prevHash: string | null;
  timestamp: string;
  digest: string;
  signature: string;
  publicKey: string;
}

export interface MintRptInput {
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: Allocation[];
  prevHash?: string | null;
  now: Date | string;
  kms?: KmsLike;
}

export interface VerificationResult {
  ok: boolean;
  error?: string;
}

export interface ChainVerificationResult extends VerificationResult {
  depth: number;
  failingRptId?: string;
}

function canonicalRptPayload(rpt: Omit<RptToken, "digest" | "signature" | "publicKey">): string {
  return stableStringify({
    rptId: rpt.rptId,
    orgId: rpt.orgId,
    bankLineId: rpt.bankLineId,
    policyHash: rpt.policyHash,
    allocations: rpt.allocations,
    prevHash: rpt.prevHash,
    timestamp: rpt.timestamp,
  });
}

export async function mintRpt({
  orgId,
  bankLineId,
  policyHash,
  allocations,
  prevHash = null,
  now,
  kms = defaultKms,
}: MintRptInput): Promise<RptToken> {
  const rptId = randomUUID();
  const timestampValue = typeof now === "string" ? new Date(now) : now;
  if (Number.isNaN(timestampValue.getTime())) {
    throw new Error("Invalid timestamp for RPT");
  }
  const timestamp = timestampValue.toISOString();

  const canonicalPayload = canonicalRptPayload({
    rptId,
    orgId,
    bankLineId,
    policyHash,
    allocations: allocations.map((allocation) => ({ ...allocation })),
    prevHash,
    timestamp,
  });

  const digest = createHash("sha256").update(canonicalPayload).digest("hex");
  const message = Buffer.from(digest, "hex");
  const { signature, publicKey } = await kms.sign(message);

  return {
    rptId,
    orgId,
    bankLineId,
    policyHash,
    allocations: allocations.map((allocation) => ({ ...allocation })),
    prevHash,
    timestamp,
    digest,
    signature,
    publicKey,
  };
}

export function verifyRpt(rpt: RptToken): VerificationResult {
  const canonicalPayload = canonicalRptPayload({
    rptId: rpt.rptId,
    orgId: rpt.orgId,
    bankLineId: rpt.bankLineId,
    policyHash: rpt.policyHash,
    allocations: rpt.allocations,
    prevHash: rpt.prevHash,
    timestamp: rpt.timestamp,
  });
  const expectedDigest = createHash("sha256").update(canonicalPayload).digest("hex");

  if (expectedDigest !== rpt.digest) {
    return { ok: false, error: "Digest mismatch" };
  }

  try {
    const isValid = verify(
      null,
      Buffer.from(rpt.digest, "hex"),
      createPublicKey(rpt.publicKey),
      Buffer.from(rpt.signature, "base64"),
    );
    if (!isValid) {
      return { ok: false, error: "Signature verification failed" };
    }
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  return { ok: true };
}

const rptStore = new Map<string, RptToken>();
const digestIndex = new Map<string, string>();

export function storeRpt(rpt: RptToken): void {
  rptStore.set(rpt.rptId, rpt);
  digestIndex.set(rpt.digest, rpt.rptId);
}

export function getRpt(rptId: string): RptToken | undefined {
  return rptStore.get(rptId);
}

export function getRptByDigest(digest: string): RptToken | undefined {
  const rptId = digestIndex.get(digest);
  return rptId ? rptStore.get(rptId) : undefined;
}

export function listRpts(): RptToken[] {
  return [...rptStore.values()];
}

export function clearRptStore(): void {
  rptStore.clear();
  digestIndex.clear();
}

export function verifyChain(headRptId: string): ChainVerificationResult {
  const visited = new Set<string>();
  let depth = 0;
  let current = getRpt(headRptId);

  if (!current) {
    return { ok: false, error: "Head RPT not found", depth, failingRptId: headRptId };
  }

  while (current) {
    if (visited.has(current.rptId)) {
      return { ok: false, error: "Cycle detected", depth, failingRptId: current.rptId };
    }
    visited.add(current.rptId);
    depth += 1;

    const verification = verifyRpt(current);
    if (!verification.ok) {
      return { ...verification, depth, failingRptId: current.rptId };
    }

    if (!current.prevHash) {
      return { ok: true, depth };
    }

    const previous = getRptByDigest(current.prevHash);
    if (!previous) {
      return { ok: false, error: "Missing predecessor", depth, failingRptId: current.rptId };
    }

    if (previous.digest !== current.prevHash) {
      return { ok: false, error: "Predecessor digest mismatch", depth, failingRptId: current.rptId };
    }

    current = previous;
  }

  return { ok: true, depth };
}
