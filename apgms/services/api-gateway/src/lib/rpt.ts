import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify,
} from "node:crypto";
import { getActiveKey, getKey, KmsKeyArtifact } from "./kms.js";

export type RptErrorCode =
  | "INVALID_FORMAT"
  | "UNKNOWN_KEY"
  | "INVALID_SIGNATURE"
  | "CHAIN_HASH_MISMATCH"
  | "CHAIN_MISMATCH";

export class RptError extends Error {
  constructor(
    message: string,
    public readonly code: RptErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "RptError";
  }
}

export interface RptMintOptions {
  subject: string;
  actions: string[];
  metadata?: Record<string, unknown>;
  previousToken?: string;
}

export interface RptHeader {
  alg: "Ed25519";
  typ: "RPT";
  kid: string;
}

export interface RptPayloadBase {
  id: string;
  subject: string;
  issuedAt: number;
  actions: string[];
  metadata?: Record<string, unknown>;
  previousHash?: string;
}

export interface RptPayload extends RptPayloadBase {
  chainHash: string;
}

export interface VerifiedRpt {
  token: string;
  header: RptHeader;
  payload: RptPayload;
  key: KmsKeyArtifact;
}

const headerTemplate = Object.freeze({ alg: "Ed25519", typ: "RPT" as const });

function base64UrlEncode(data: string | Uint8Array): string {
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  return buffer.toString("base64url");
}

function base64UrlDecode(data: string): Buffer {
  return Buffer.from(data, "base64url");
}

function base64Decode(data: string): Buffer {
  return Buffer.from(data, "base64");
}

function sanitizeValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, sanitizeValue(v)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

function normalizeBasePayload(base: RptPayloadBase): RptPayloadBase {
  const normalized: RptPayloadBase = {
    id: base.id,
    subject: base.subject,
    issuedAt: base.issuedAt,
    actions: [...base.actions],
  };

  if (base.metadata !== undefined) {
    const sanitized = sanitizeValue(base.metadata) as Record<string, unknown> | undefined;
    if (sanitized !== undefined) {
      normalized.metadata = sanitized;
    }
  }

  if (base.previousHash !== undefined) {
    normalized.previousHash = base.previousHash;
  }

  return normalized;
}

function canonicalize(value: unknown): string {
  if (value === null) {
    return "null";
  }
  const type = typeof value;
  if (type === "number" || type === "boolean") {
    return JSON.stringify(value);
  }
  if (type === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (type === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Base64Url(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

function hashPayload(base: RptPayloadBase): string {
  const normalized = normalizeBasePayload(base);
  return sha256Base64Url(canonicalize(normalized));
}

function computeChainHash(base: RptPayloadBase, previousChainHash?: string): string {
  const payloadHash = hashPayload(base);
  if (previousChainHash) {
    return sha256Base64Url(`${previousChainHash}.${payloadHash}`);
  }
  return payloadHash;
}

function parseToken(token: string): [string, string, string] {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new RptError("RPT must have three segments", "INVALID_FORMAT");
  }
  return segments as [string, string, string];
}

export async function mintRpt(options: RptMintOptions): Promise<string> {
  const key = await getActiveKey();
  let previousHash: string | undefined;

  if (options.previousToken) {
    const previous = await verifyRpt(options.previousToken);
    if (previous.payload.subject !== options.subject) {
      throw new RptError("Previous token subject mismatch", "CHAIN_MISMATCH");
    }
    previousHash = previous.payload.chainHash;
  }

  const basePayload: RptPayloadBase = {
    id: randomUUID(),
    subject: options.subject,
    issuedAt: Date.now(),
    actions: [...options.actions],
    metadata: options.metadata,
    previousHash,
  };

  const normalizedBase = normalizeBasePayload(basePayload);
  const chainHash = computeChainHash(normalizedBase, previousHash);
  const payload: RptPayload = {
    ...normalizedBase,
    chainHash,
  };

  const header: RptHeader = { ...headerTemplate, kid: key.id };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const privateKey = createPrivateKey({
    key: base64Decode(key.secretKey),
    format: "der",
    type: "pkcs8",
  });
  const signature = sign(null, Buffer.from(signingInput), privateKey);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function assertHeader(value: unknown): asserts value is RptHeader {
  if (!value || typeof value !== "object") {
    throw new RptError("Invalid RPT header", "INVALID_FORMAT");
  }
  const header = value as Record<string, unknown>;
  if (header.alg !== "Ed25519" || header.typ !== "RPT" || typeof header.kid !== "string") {
    throw new RptError("Invalid RPT header", "INVALID_FORMAT");
  }
}

function assertPayload(value: unknown): asserts value is RptPayload {
  if (!value || typeof value !== "object") {
    throw new RptError("Invalid RPT payload", "INVALID_FORMAT");
  }
  const payload = value as Record<string, unknown>;
  if (typeof payload.id !== "string" || typeof payload.subject !== "string") {
    throw new RptError("Invalid RPT payload", "INVALID_FORMAT");
  }
  if (typeof payload.issuedAt !== "number" || !Array.isArray(payload.actions)) {
    throw new RptError("Invalid RPT payload", "INVALID_FORMAT");
  }
  if (typeof payload.chainHash !== "string") {
    throw new RptError("Invalid RPT payload", "INVALID_FORMAT");
  }
  if (payload.previousHash !== undefined && typeof payload.previousHash !== "string") {
    throw new RptError("Invalid RPT payload", "INVALID_FORMAT");
  }
  if (payload.metadata !== undefined && (typeof payload.metadata !== "object" || payload.metadata === null)) {
    throw new RptError("Invalid RPT payload", "INVALID_FORMAT");
  }
}

export async function verifyRpt(token: string): Promise<VerifiedRpt> {
  const [encodedHeader, encodedPayload, encodedSignature] = parseToken(token);

  let decodedHeader: unknown;
  let decodedPayload: unknown;

  try {
    decodedHeader = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    decodedPayload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch (error: unknown) {
    throw new RptError("Failed to decode RPT", "INVALID_FORMAT", { cause: error });
  }

  assertHeader(decodedHeader);
  assertPayload(decodedPayload);

  const key = await getKey(decodedHeader.kid);
  if (!key) {
    throw new RptError("Unknown key identifier", "UNKNOWN_KEY");
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = base64UrlDecode(encodedSignature);
  const publicKey = createPublicKey({
    key: base64Decode(key.publicKey),
    format: "der",
    type: "spki",
  });

  const signatureValid = verify(null, Buffer.from(signingInput), publicKey, signature);
  if (!signatureValid) {
    throw new RptError("Invalid RPT signature", "INVALID_SIGNATURE");
  }

  const normalizedBase = normalizeBasePayload(decodedPayload);
  const expectedChainHash = computeChainHash(normalizedBase, decodedPayload.previousHash);
  if (expectedChainHash !== decodedPayload.chainHash) {
    throw new RptError("RPT chain hash mismatch", "CHAIN_HASH_MISMATCH");
  }

  const payload: RptPayload = { ...normalizedBase, chainHash: decodedPayload.chainHash };
  return {
    token,
    header: decodedHeader,
    payload,
    key,
  };
}

export async function verifyChain(tokens: string[]): Promise<VerifiedRpt[]> {
  const verified: VerifiedRpt[] = [];
  for (const token of tokens) {
    const current = await verifyRpt(token);
    const previous = verified.at(-1);
    if (previous) {
      if (current.payload.previousHash !== previous.payload.chainHash) {
        throw new RptError("RPT chain break", "CHAIN_MISMATCH");
      }
      if (current.payload.subject !== previous.payload.subject) {
        throw new RptError("RPT subjects must match within a chain", "CHAIN_MISMATCH");
      }
    }
    verified.push(current);
  }
  return verified;
}

