import { createHash } from 'crypto';
import { getPublicKey, sign, verify, utils } from '@noble/ed25519';

export type RptToken = {
  rptId: string;
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: { bucket: string; amountCents: number; currency: string }[];
  prevHash: string;
  timestamp: string;
  sig: string;
};

export interface KmsLike {
  getPublicKey(): Promise<string>;
  sign(data: Uint8Array): Promise<string>;
}

export class DevKms implements KmsLike {
  private readonly privateKey: Uint8Array;
  private readonly publicKey: Uint8Array;

  constructor(privateKey?: Uint8Array) {
    this.privateKey = privateKey ?? utils.randomPrivateKey();
    this.publicKey = getPublicKey(this.privateKey);
  }

  async getPublicKey(): Promise<string> {
    return utils.bytesToHex(this.publicKey);
  }

  async sign(data: Uint8Array): Promise<string> {
    const signature = await sign(data, this.privateKey);
    return utils.bytesToHex(signature);
  }
}

export function canonicalize(obj: any): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(canonicalStringify(obj));
}

function canonicalStringify(value: any): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  const type = typeof value;
  if (type === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Cannot canonicalize non-finite numbers');
    }
    return JSON.stringify(value);
  }
  if (type === 'string' || type === 'boolean') {
    return JSON.stringify(value);
  }
  if (type === 'object') {
    const keys = Object.keys(value).sort();
    const props = keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`);
    return `{${props.join(',')}}`;
  }
  throw new TypeError(`Unsupported type for canonicalization: ${type}`);
}

export function hash(input: Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeAllocations(allocations: any[]): { bucket: string; amountCents: number; currency: string }[] {
  return allocations.map((allocation) => {
    if (!allocation) {
      throw new TypeError('Allocation is required');
    }
    const bucket = String(allocation.bucket);
    const amountCents = Number(allocation.amountCents);
    if (!Number.isFinite(amountCents)) {
      throw new TypeError('Allocation amountCents must be finite');
    }
    const currency = String(allocation.currency);
    return { bucket, amountCents, currency };
  });
}

function rptBody(rpt: { orgId: string; bankLineId: string; policyHash: string; allocations: RptToken['allocations']; prevHash: string; timestamp: string }) {
  return {
    orgId: rpt.orgId,
    bankLineId: rpt.bankLineId,
    policyHash: rpt.policyHash,
    allocations: rpt.allocations,
    prevHash: rpt.prevHash,
    timestamp: rpt.timestamp,
  };
}

function rptPayload(rpt: { rptId: string; orgId: string; bankLineId: string; policyHash: string; allocations: RptToken['allocations']; prevHash: string; timestamp: string }) {
  return {
    rptId: rpt.rptId,
    orgId: rpt.orgId,
    bankLineId: rpt.bankLineId,
    policyHash: rpt.policyHash,
    allocations: rpt.allocations,
    prevHash: rpt.prevHash,
    timestamp: rpt.timestamp,
  };
}

export async function mintRpt(
  kms: KmsLike,
  args: {
    orgId: string;
    bankLineId: string;
    policyHash: string;
    allocations: any[];
    prevHash: string;
    now: string;
  },
): Promise<RptToken> {
  const allocations = normalizeAllocations(args.allocations);
  const body = {
    orgId: args.orgId,
    bankLineId: args.bankLineId,
    policyHash: args.policyHash,
    allocations,
    prevHash: args.prevHash,
    timestamp: args.now,
  };
  const rptId = hash(canonicalize(body));
  const payload = rptPayload({ rptId, ...body });
  const message = canonicalize(payload);
  const sig = await kms.sign(message);
  return { ...payload, sig };
}

function assertHexString(value: string, label: string): void {
  if (!/^([0-9a-f]{2})+$/i.test(value)) {
    throw new TypeError(`${label} must be a hex string`);
  }
}

function stripSig(rpt: RptToken) {
  return rptPayload(rpt);
}

async function verifyRptSignature(pubKeyHex: string, rpt: RptToken): Promise<boolean> {
  assertHexString(pubKeyHex, 'Public key');
  assertHexString(rpt.sig, 'Signature');
  const message = canonicalize(stripSig(rpt));
  const sigBytes = utils.hexToBytes(rpt.sig);
  const pubKeyBytes = utils.hexToBytes(pubKeyHex);
  return verify(sigBytes, message, pubKeyBytes);
}

export async function verifyRpt(pubKeyHex: string, rpt: RptToken): Promise<boolean> {
  const body = rptBody(rpt);
  const expectedId = hash(canonicalize(body));
  if (rpt.rptId !== expectedId) {
    return false;
  }
  return verifyRptSignature(pubKeyHex, rpt);
}

export async function verifyChain(
  pubKeyHex: string,
  fetchRpt: (id: string) => Promise<RptToken | null>,
  headRptId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!headRptId) {
    return { ok: false, reason: 'Head RPT id is required' };
  }
  const visited = new Set<string>();
  let currentId: string | null = headRptId;
  let child: RptToken | null = null;
  while (currentId) {
    if (visited.has(currentId)) {
      return { ok: false, reason: 'Cycle detected in RPT chain' };
    }
    visited.add(currentId);
    const rpt = await fetchRpt(currentId);
    if (!rpt) {
      return { ok: false, reason: `Missing RPT for id ${currentId}` };
    }
    if (rpt.rptId !== currentId) {
      return { ok: false, reason: `RPT id mismatch for ${currentId}` };
    }
    if (!(await verifyRpt(pubKeyHex, rpt))) {
      return { ok: false, reason: `Invalid RPT signature for ${currentId}` };
    }
    if (child && child.prevHash !== rpt.rptId) {
      return { ok: false, reason: `Broken linkage between ${child.rptId} and ${rpt.rptId}` };
    }
    if (!rpt.prevHash) {
      return { ok: true };
    }
    child = rpt;
    currentId = rpt.prevHash;
  }
  return { ok: false, reason: 'Chain terminated unexpectedly' };
}
