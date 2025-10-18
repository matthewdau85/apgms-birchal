import crypto from "node:crypto";

export interface RptAllocation {
  accountId: string;
  amount: string;
}

export interface MintRptInput {
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: RptAllocation[];
  prevHash?: string | null;
  now?: Date;
}

export interface RptPayload {
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: RptAllocation[];
  prevHash: string | null;
  timestamp: string;
}

export interface RptToken extends RptPayload {
  hash: string;
  signature: string;
}

export interface LedgerEntryRecord {
  id: string;
  orgId: string;
  bankLineId: string;
  rptHash: string;
  allocations: RptAllocation[];
  createdAt: string;
}

const kms = crypto.generateKeyPairSync("ed25519");

const rptStore = new Map<string, RptToken>();
const ledgerEntries: LedgerEntryRecord[] = [];

const sortAllocations = (allocations: RptAllocation[]): RptAllocation[] =>
  [...allocations]
    .map((allocation) => ({
      accountId: allocation.accountId,
      amount: allocation.amount,
    }))
    .sort((a, b) => {
      if (a.accountId === b.accountId) {
        return a.amount.localeCompare(b.amount);
      }
      return a.accountId.localeCompare(b.accountId);
    });

const canonicalizePayload = (payload: RptPayload): string =>
  JSON.stringify({
    orgId: payload.orgId,
    bankLineId: payload.bankLineId,
    policyHash: payload.policyHash,
    allocations: sortAllocations(payload.allocations),
    prevHash: payload.prevHash ?? null,
    timestamp: payload.timestamp,
  });

const deriveHash = (payload: RptPayload, signature: string): string =>
  crypto
    .createHash("sha256")
    .update(canonicalizePayload(payload))
    .update(signature)
    .digest("hex");

export const mintRpt = ({
  orgId,
  bankLineId,
  policyHash,
  allocations,
  prevHash = null,
  now,
}: MintRptInput): RptToken => {
  const timestamp = (now ?? new Date()).toISOString();
  const normalizedAllocations = sortAllocations(allocations).map((allocation) => ({
    accountId: allocation.accountId,
    amount: allocation.amount,
  }));
  const payload: RptPayload = {
    orgId,
    bankLineId,
    policyHash,
    allocations: normalizedAllocations,
    prevHash: prevHash ?? null,
    timestamp,
  };
  const canonical = canonicalizePayload(payload);
  const signature = crypto
    .sign(null, Buffer.from(canonical), kms.privateKey)
    .toString("base64");
  const hash = deriveHash(payload, signature);
  return { ...payload, hash, signature };
};

export const verifyRpt = (rpt: RptToken): void => {
  const payload: RptPayload = {
    orgId: rpt.orgId,
    bankLineId: rpt.bankLineId,
    policyHash: rpt.policyHash,
    allocations: sortAllocations(rpt.allocations),
    prevHash: rpt.prevHash ?? null,
    timestamp: rpt.timestamp,
  };

  const canonical = canonicalizePayload(payload);
  const signatureBuffer = Buffer.from(rpt.signature, "base64");
  const verified = crypto.verify(null, Buffer.from(canonical), kms.publicKey, signatureBuffer);
  if (!verified) {
    throw new Error("Invalid RPT signature");
  }

  const expectedHash = deriveHash(payload, rpt.signature);
  if (expectedHash !== rpt.hash) {
    throw new Error("Invalid RPT hash");
  }
};

export const storeRptToken = (rpt: RptToken): void => {
  verifyRpt(rpt);
  rptStore.set(rpt.hash, {
    ...rpt,
    allocations: rpt.allocations.map((allocation) => ({ ...allocation })),
  });
};

export const getRptToken = (hash: string): RptToken | null => {
  const token = rptStore.get(hash);
  if (!token) {
    return null;
  }
  return {
    ...token,
    allocations: token.allocations.map((allocation) => ({ ...allocation })),
  };
};

export const recordLedgerEntry = ({
  orgId,
  bankLineId,
  rptHash,
  allocations,
  now,
}: {
  orgId: string;
  bankLineId: string;
  rptHash: string;
  allocations: RptAllocation[];
  now?: Date;
}): LedgerEntryRecord => {
  const entry: LedgerEntryRecord = {
    id: crypto.randomUUID(),
    orgId,
    bankLineId,
    rptHash,
    allocations: sortAllocations(allocations),
    createdAt: (now ?? new Date()).toISOString(),
  };
  ledgerEntries.push(entry);
  return {
    ...entry,
    allocations: entry.allocations.map((allocation) => ({ ...allocation })),
  };
};

export const listLedgerEntries = (): LedgerEntryRecord[] =>
  ledgerEntries.map((entry) => ({
    ...entry,
    allocations: entry.allocations.map((allocation) => ({ ...allocation })),
  }));

export const verifyChain = (headRptId: string): void => {
  let current: string | null = headRptId;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) {
      throw new Error("Detected cycle in RPT chain");
    }
    visited.add(current);
    const rpt = rptStore.get(current);
    if (!rpt) {
      throw new Error(`Missing RPT for hash ${current}`);
    }
    verifyRpt(rpt);
    current = rpt.prevHash ?? null;
  }
};

export const resetRptState = (): void => {
  rptStore.clear();
  ledgerEntries.splice(0, ledgerEntries.length);
};

