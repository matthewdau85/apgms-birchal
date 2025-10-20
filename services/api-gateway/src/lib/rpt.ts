import { createHash } from 'crypto';
import { getPublicKey, sign as edSign, utils as edUtils, verify as edVerify } from '@noble/ed25519';

export type RptAllocation = {
  bucket: string;
  amountCents: number;
  currency: string;
};

export type RptToken = {
  rptId: string;
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: RptAllocation[];
  prevHash: string;
  timestamp: string;
  sig: string;
};

export interface KmsLike {
  getPublicKey(): Promise<string>;
  sign(data: Uint8Array): Promise<string>;
}

const textEncoder = new TextEncoder();

function hexFromBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function bytesFromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

function toCanonicalValue(value: any): any {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toCanonicalValue(item));
  }

  const sortedKeys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
  const result: Record<string, any> = {};

  for (const key of sortedKeys) {
    result[key] = toCanonicalValue(value[key]);
  }

  return result;
}

export function canonicalize(obj: any): Uint8Array {
  const normalized = toCanonicalValue(obj);
  const json = JSON.stringify(normalized);
  return textEncoder.encode(json);
}

export function hash(input: Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

export class DevKms implements KmsLike {
  private readonly privateKey: Uint8Array;
  private readonly publicKeyPromise: Promise<Uint8Array>;

  constructor() {
    this.privateKey = edUtils.randomPrivateKey();
    this.publicKeyPromise = Promise.resolve(getPublicKey(this.privateKey));
  }

  async getPublicKey(): Promise<string> {
    const publicKey = await this.publicKeyPromise;
    return hexFromBytes(publicKey);
  }

  async sign(data: Uint8Array): Promise<string> {
    const signature = await edSign(data, this.privateKey);
    return hexFromBytes(signature);
  }
}

function canonicalRptBase(rpt: Omit<RptToken, 'rptId' | 'sig'>) {
  return {
    orgId: rpt.orgId,
    bankLineId: rpt.bankLineId,
    policyHash: rpt.policyHash,
    allocations: rpt.allocations.map((allocation) => ({
      bucket: allocation.bucket,
      amountCents: allocation.amountCents,
      currency: allocation.currency,
    })),
    prevHash: rpt.prevHash,
    timestamp: rpt.timestamp,
  };
}

function canonicalRptForSigning(rpt: Omit<RptToken, 'sig'>) {
  return {
    ...canonicalRptBase(rpt),
    rptId: rpt.rptId,
  };
}

function computeRptId(base: Omit<RptToken, 'rptId' | 'sig'>): string {
  return hash(canonicalize(canonicalRptBase(base)));
}

function canonicalRptForHash(rpt: RptToken) {
  return {
    ...canonicalRptForSigning(rpt),
    sig: rpt.sig,
  };
}

export async function mintRpt(
  kms: KmsLike,
  args: {
    orgId: string;
    bankLineId: string;
    policyHash: string;
    allocations: RptAllocation[];
    prevHash: string;
    now: string;
  },
): Promise<RptToken> {
  const base: Omit<RptToken, 'rptId' | 'sig'> = {
    orgId: args.orgId,
    bankLineId: args.bankLineId,
    policyHash: args.policyHash,
    allocations: args.allocations.map((allocation) => ({
      bucket: allocation.bucket,
      amountCents: allocation.amountCents,
      currency: allocation.currency,
    })),
    prevHash: args.prevHash,
    timestamp: args.now,
  };

  const rptId = computeRptId(base);
  const signPayload = canonicalize(canonicalRptForSigning({ ...base, rptId }));
  const sig = await kms.sign(signPayload);

  return {
    ...base,
    rptId,
    sig,
  };
}

export async function verifyRpt(pubKeyHex: string, rpt: RptToken): Promise<boolean> {
  try {
    const base = canonicalRptBase(rpt);
    const expectedRptId = computeRptId(base);
    if (expectedRptId !== rpt.rptId) {
      return false;
    }

    const signPayload = canonicalize(canonicalRptForSigning(rpt));
    const publicKey = bytesFromHex(pubKeyHex);
    const signature = bytesFromHex(rpt.sig);

    return await edVerify(signature, signPayload, publicKey);
  } catch {
    return false;
  }
}

export async function verifyChain(
  pubKeyHex: string,
  fetchRpt: (id: string) => Promise<RptToken | null>,
  headRptId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const visited = new Set<string>();
  let currentId: string | null = headRptId;

  while (currentId) {
    if (visited.has(currentId)) {
      return { ok: false, reason: `cycle detected at ${currentId}` };
    }

    const rpt = await fetchRpt(currentId);
    if (!rpt) {
      return { ok: false, reason: `missing RPT ${currentId}` };
    }

    if (rpt.rptId !== currentId) {
      return { ok: false, reason: `RPT id mismatch for ${currentId}` };
    }

    visited.add(currentId);

    const valid = await verifyRpt(pubKeyHex, rpt);
    if (!valid) {
      return { ok: false, reason: `invalid signature for ${currentId}` };
    }

    const prevId = rpt.prevHash;
    if (!prevId || prevId === 'GENESIS') {
      return { ok: true };
    }

    currentId = prevId;
  }

  return { ok: true };
}

export function computeRptHash(rpt: RptToken): string {
  return hash(canonicalize(canonicalRptForHash(rpt)));
}
