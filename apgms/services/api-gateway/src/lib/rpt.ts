import {
  createHash,
  createPrivateKey,
  createPublicKey,
  KeyObject,
  sign as edSign,
  verify as edVerify,
} from "node:crypto";

export interface RptAllocation {
  accountId: string;
  amount: number;
}

export interface MintRptArgs {
  orgId: string;
  bankLineId: string;
  policyHash: string;
  allocations: RptAllocation[];
  prevHash?: string | null;
  now: string;
}

export interface RptToken extends MintRptArgs {
  hash: string;
  signature: string;
  publicKey: string;
  prevHash: string | null;
}

const rptStore = new Map<string, RptToken>();

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

let cachedPrivateKey: KeyObject | undefined;

function derivePrivateKey(): KeyObject {
  if (!cachedPrivateKey) {
    const baseKey = process.env.RPT_PRIVATE_KEY ?? "apgms-dev-key";
    const seed = createHash("sha256").update(baseKey).digest();
    const pkcs8 = Buffer.concat([PKCS8_PREFIX, seed]);
    cachedPrivateKey = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
  }
  return cachedPrivateKey;
}

function exportPublicKeyHex(privateKey: KeyObject): string {
  const publicKeyDer = createPublicKey(privateKey).export({ format: "der", type: "spki" }) as Buffer;
  return publicKeyDer.subarray(publicKeyDer.length - 32).toString("hex");
}

function importPublicKey(hex: string): KeyObject {
  const der = Buffer.concat([SPKI_PREFIX, Buffer.from(hex, "hex")]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

function encodeAllocations(allocations: RptAllocation[]): string {
  const sorted = [...allocations].sort((a, b) => a.accountId.localeCompare(b.accountId));
  return JSON.stringify(sorted);
}

function computeRptMessage(args: MintRptArgs): string {
  return [
    args.orgId,
    args.bankLineId,
    args.policyHash,
    encodeAllocations(args.allocations),
    args.prevHash ?? "",
    args.now,
  ].join("|");
}

function computeRptHash(args: MintRptArgs): string {
  const canonical = computeRptMessage(args);
  return createHash("sha256").update(canonical).digest("hex");
}

export async function mintRpt(args: MintRptArgs): Promise<RptToken> {
  const { prevHash = null } = args;
  const payload: MintRptArgs = { ...args, prevHash };
  const message = computeRptMessage(payload);
  const hash = createHash("sha256").update(message).digest("hex");
  const privateKey = derivePrivateKey();
  const signatureBytes = edSign(null, Buffer.from(message), privateKey);
  const publicKey = exportPublicKeyHex(privateKey);
  const signature = Buffer.from(signatureBytes).toString("hex");

  const token: RptToken = {
    ...payload,
    hash,
    signature,
    publicKey,
  };

  rptStore.set(hash, token);
  return token;
}

export function getRpt(id: string): RptToken | undefined {
  return rptStore.get(id);
}

export function deleteRpt(id: string): void {
  rptStore.delete(id);
}

export function resetRptStore(): void {
  rptStore.clear();
}

export function storeRptUnsafe(token: RptToken): void {
  rptStore.set(token.hash, token);
}

export async function verifyRpt(token: RptToken): Promise<boolean> {
  const expectedHash = computeRptHash(token);
  if (expectedHash !== token.hash) {
    return false;
  }

  const publicKey = importPublicKey(token.publicKey);
  const signatureBytes = Buffer.from(token.signature, "hex");
  const message = computeRptMessage(token);
  return edVerify(null, Buffer.from(message), publicKey, signatureBytes);
}

export async function verifyChain(headRptId: string): Promise<boolean> {
  let current = rptStore.get(headRptId);
  if (!current) {
    return false;
  }

  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.hash)) {
      return false; // loop detected
    }
    visited.add(current.hash);

    const valid = await verifyRpt(current);
    if (!valid) {
      return false;
    }

    if (!current.prevHash) {
      return true;
    }

    const prev = rptStore.get(current.prevHash);
    if (!prev) {
      return false;
    }

    current = prev;
  }

  return true;
}
