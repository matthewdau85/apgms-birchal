import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type SignerProvider = "local" | "kms";

const signerProviderEnv = process.env.SIGNER_PROVIDER?.toLowerCase();
export const signerProvider: SignerProvider = signerProviderEnv === "kms" ? "kms" : "local";

interface SignerKey {
  keyId: string;
  secret: Buffer;
}

const activeKey: SignerKey = signerProvider === "kms"
  ? {
      keyId: process.env.KMS_SIGNER_KEY_ID ?? "kms-primary",
      secret: Buffer.from(process.env.KMS_SIGNER_SECRET ?? process.env.SIGNER_SECRET ?? "kms-secret"),
    }
  : {
      keyId: process.env.LOCAL_SIGNER_KEY_ID ?? "local-primary",
      secret: Buffer.from(process.env.LOCAL_SIGNER_SECRET ?? process.env.SIGNER_SECRET ?? "local-secret"),
    };

const keyStore = new Map<string, Buffer>();
keyStore.set(activeKey.keyId, activeKey.secret);

const evidenceFile = "/evidence/keys/provider.json";

interface EvidenceRecord {
  provider: SignerProvider;
  keyId: string;
  ts: string;
}

async function writeEvidence(record: EvidenceRecord): Promise<void> {
  try {
    await mkdir(path.dirname(evidenceFile), { recursive: true });
    await writeFile(evidenceFile, JSON.stringify(record, null, 2), "utf8");
  } catch (error) {
    console.warn("[rpt] failed to write signer evidence", error);
  }
}

void writeEvidence({ provider: signerProvider, keyId: activeKey.keyId, ts: new Date().toISOString() });

export interface AllocationDetails {
  id: string;
  amount: string;
  currency: string;
}

export interface RptPayload {
  allocation: AllocationDetails;
  issuedAt: string;
  prevHash?: string;
  metadata?: Record<string, unknown>;
}

export interface Rpt extends RptPayload {
  keyId: string;
  signature: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, val]) => val !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",")}}`;
}

function canonicalPayload(payload: RptPayload): string {
  return stableStringify(payload);
}

function assertKey(keyId: string): Buffer {
  const secret = keyStore.get(keyId);
  if (!secret) {
    throw new Error(`unknown signer key: ${keyId}`);
  }
  return secret;
}

export function registerSignerKey(keyId: string, secret: string | Buffer): void {
  keyStore.set(keyId, Buffer.isBuffer(secret) ? secret : Buffer.from(secret));
}

export const activeKeyId = activeKey.keyId;

function payloadFromRpt(rpt: Rpt): RptPayload {
  const { keyId: _keyId, signature: _signature, ...payload } = rpt;
  return payload;
}

export function hashRptPayload(rpt: RptPayload | Rpt): string {
  const payload = "signature" in rpt ? payloadFromRpt(rpt) : rpt;
  const canonical = canonicalPayload(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

export function signRpt(payload: RptPayload, keyId: string = activeKey.keyId): Rpt {
  const canonical = canonicalPayload(payload);
  const secret = assertKey(keyId);
  const signature = createHmac("sha256", secret).update(canonical).digest("hex");
  return { ...payload, keyId, signature };
}

export function verifyRpt(rpt: Rpt): boolean {
  const payload = payloadFromRpt(rpt);
  const canonical = canonicalPayload(payload);
  const secret = keyStore.get(rpt.keyId);

  if (!secret) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(canonical).digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(rpt.signature, "hex");
  } catch {
    return false;
  }

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export function verifyChain(chain: Rpt[]): boolean {
  for (let index = 0; index < chain.length; index += 1) {
    const current = chain[index];
    if (!verifyRpt(current)) {
      return false;
    }

    if (index === 0) {
      continue;
    }

    const expectedPrevHash = hashRptPayload(chain[index - 1]);
    if (!current.prevHash || current.prevHash !== expectedPrevHash) {
      return false;
    }
  }

  return true;
}
