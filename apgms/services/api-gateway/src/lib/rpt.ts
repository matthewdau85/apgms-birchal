import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";

import type { AllocationResult } from "../../../../shared/policy-engine/index";

let prismaClient: any | null = null;
let prismaLoadFailed = false;

const resolvePrisma = async () => {
  if (prismaClient || prismaLoadFailed) {
    return prismaClient;
  }
  try {
    const module = await import("../../../../shared/src/db.js");
    prismaClient = module.prisma;
  } catch (error) {
    prismaLoadFailed = true;
  }
  return prismaClient;
};

const { publicKey: kmsPublicKey, privateKey: kmsPrivateKey } = generateKeyPairSync(
  "ed25519",
);

const publicKeyPem = kmsPublicKey.export({ format: "pem", type: "spki" }).toString();

export interface MintRptInput {
  bankLineId: string;
  policyHash: string;
  allocations: AllocationResult[];
  prevHash?: string | null;
  now: string;
}

export interface RptPayload {
  bankLineId: string;
  policyHash: string;
  allocations: AllocationResult[];
  prevHash: string | null;
  now: string;
}

export interface RptToken {
  id: string;
  payload: RptPayload;
  hash: string;
  signature: string;
  publicKey: string;
}

const rptStore = new Map<string, RptToken>();

const canonicalisePayload = (payload: RptPayload): string =>
  JSON.stringify({
    ...payload,
    allocations: payload.allocations.map((allocation) => ({
      accountId: allocation.accountId,
      amount: Number(allocation.amount.toFixed(2)),
      gate: allocation.gate,
      ruleId: allocation.ruleId,
      weight: allocation.weight,
    })),
  });

export function mintRpt(input: MintRptInput): RptToken {
  const payload: RptPayload = {
    bankLineId: input.bankLineId,
    policyHash: input.policyHash,
    allocations: input.allocations.map((allocation) => ({
      ...allocation,
      amount: Number(allocation.amount.toFixed(2)),
    })),
    prevHash: input.prevHash ?? null,
    now: input.now,
  };

  const canonical = canonicalisePayload(payload);
  const hash = createHash("sha256").update(canonical).digest("hex");
  const signature = sign(null, Buffer.from(canonical), kmsPrivateKey).toString("base64");

  const token: RptToken = {
    id: hash,
    payload,
    hash,
    signature,
    publicKey: publicKeyPem,
  };

  rptStore.set(token.id, token);

  return token;
}

export function verifyRpt(token: RptToken): boolean {
  const canonical = canonicalisePayload(token.payload);
  const expectedHash = createHash("sha256").update(canonical).digest("hex");
  if (token.hash !== expectedHash) {
    return false;
  }
  try {
    const key = createPublicKey(token.publicKey);
    return verify(null, Buffer.from(canonical), key, Buffer.from(token.signature, "base64"));
  } catch (error) {
    return false;
  }
}

async function loadRptToken(id: string): Promise<RptToken | null> {
  const cached = rptStore.get(id);
  if (cached) {
    return cached;
  }
  try {
    const prisma = await resolvePrisma();
    if (!prisma) {
      return null;
    }
    const record = await prisma.rptToken.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    const payload = record.payload as RptPayload;
    const token: RptToken = {
      id: record.id,
      payload,
      hash: record.hash,
      signature: record.signature,
      publicKey: record.publicKey,
    };
    rptStore.set(token.id, token);
    return token;
  } catch (error) {
    return null;
  }
}

export async function verifyChain(headRptId: string): Promise<boolean> {
  let current: string | null = headRptId;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) {
      return false;
    }
    visited.add(current);
    const token = await loadRptToken(current);
    if (!token) {
      return false;
    }
    if (!verifyRpt(token)) {
      return false;
    }
    current = token.payload.prevHash;
  }
  return true;
}

export async function getRptToken(id: string): Promise<RptToken | null> {
  return loadRptToken(id);
}

export function __resetRptStoreForTests(): void {
  rptStore.clear();
}

export function __setRptTokenForTests(token: RptToken): void {
  rptStore.set(token.id, token);
}
