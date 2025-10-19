import { createHash, createPrivateKey, createPublicKey, KeyObject, sign, verify } from "node:crypto";

type KeyLike = KeyObject | string | Buffer;

export type CanonicalValue =
  | null
  | string
  | number
  | boolean
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

export interface RptTokenLike {
  rptId: string;
  bankLineId: string;
  orgId: string;
  payload: unknown;
  prevHash: string | null;
  signature: string;
  hash: string;
  publicKey: string;
}

export interface MintRptInput {
  rptId: string;
  bankLineId: string;
  orgId: string;
  payload: unknown;
  prevHash?: string | null;
  privateKey: KeyLike;
  publicKey?: KeyLike;
}

const normalize = (value: unknown): CanonicalValue => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => typeof v !== "undefined")
      .sort(([a], [b]) => a.localeCompare(b));
    const result: { [key: string]: CanonicalValue } = {};
    for (const [key, val] of entries) {
      result[key] = normalize(val);
    }
    return result;
  }

  return value?.toString?.() ?? String(value);
};

export const canonicalize = (value: unknown): string => {
  const canonical = normalize(value);
  return JSON.stringify(canonical);
};

const ensurePrivateKey = (key: KeyLike): KeyObject =>
  key instanceof KeyObject && key.type === "private" ? key : createPrivateKey(key);

const ensurePublicKey = (key: KeyLike): KeyObject =>
  key instanceof KeyObject && key.type === "public" ? key : createPublicKey(key);

const exportPublicKey = (key: KeyLike): string => {
  const keyObj = ensurePublicKey(key);
  return keyObj.export({ type: "spki", format: "pem" }).toString();
};

const canonicalPayload = (token: {
  rptId: string;
  bankLineId: string;
  orgId: string;
  payload: unknown;
  prevHash: string | null;
}): string =>
  canonicalize({
    rptId: token.rptId,
    bankLineId: token.bankLineId,
    orgId: token.orgId,
    payload: token.payload,
    prevHash: token.prevHash,
  });

const computeHash = (token: {
  rptId: string;
  bankLineId: string;
  orgId: string;
  payload: unknown;
  prevHash: string | null;
}): string => {
  const canonical = canonicalPayload(token);
  return createHash("sha256").update(canonical).digest("hex");
};

export const mintRpt = ({
  rptId,
  bankLineId,
  orgId,
  payload,
  prevHash,
  privateKey,
  publicKey,
}: MintRptInput): RptTokenLike => {
  const normalizedPrevHash = prevHash ?? null;
  const privateKeyObj = ensurePrivateKey(privateKey);
  const publicKeyObj = publicKey ? ensurePublicKey(publicKey) : createPublicKey(privateKeyObj);
  const canonical = canonicalPayload({ rptId, bankLineId, orgId, payload, prevHash: normalizedPrevHash });
  const signature = sign(null, Buffer.from(canonical), privateKeyObj).toString("base64");
  const hash = createHash("sha256").update(canonical).digest("hex");
  const publicKeyPem = exportPublicKey(publicKeyObj);

  return {
    rptId,
    bankLineId,
    orgId,
    payload,
    prevHash: normalizedPrevHash,
    signature,
    hash,
    publicKey: publicKeyPem,
  };
};

export const verifyRpt = (token: RptTokenLike, suppliedPublicKey?: KeyLike): boolean => {
  try {
    const publicKeyObj = suppliedPublicKey
      ? ensurePublicKey(suppliedPublicKey)
      : ensurePublicKey(token.publicKey);
    const canonical = canonicalPayload(token);
    const expectedHash = computeHash(token);
    if (token.hash !== expectedHash) {
      return false;
    }
    const signatureBuffer = Buffer.from(token.signature, "base64");
    return verify(null, Buffer.from(canonical), publicKeyObj, signatureBuffer);
  } catch {
    return false;
  }
};

export const verifyChain = (tokens: RptTokenLike[]): boolean => {
  let previousHash: string | null = null;
  for (const token of tokens) {
    const normalizedPrevHash = token.prevHash ?? null;
    if (normalizedPrevHash !== previousHash) {
      return false;
    }
    if (!verifyRpt(token)) {
      return false;
    }
    const expectedHash = computeHash(token);
    if (token.hash !== expectedHash) {
      return false;
    }
    previousHash = token.hash;
  }
  return true;
};
