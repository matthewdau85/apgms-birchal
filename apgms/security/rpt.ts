import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { generateKeyPairSync } from "node:crypto";

export interface RptHeader {
  readonly alg: "EdDSA";
  readonly typ: "RPT";
  readonly kid: string;
}

export interface RptClaims {
  readonly sub: string;
  readonly scopes: readonly string[];
  readonly aud?: string;
  readonly context?: Record<string, unknown>;
  readonly iat: number;
  readonly exp?: number;
  readonly [key: string]: unknown;
}

export interface SignedRpt {
  readonly header: RptHeader;
  readonly payload: RptClaims;
  readonly token: string;
}

export interface RptVerification {
  readonly valid: boolean;
  readonly header?: RptHeader;
  readonly payload?: RptClaims;
  readonly error?: string;
}

export interface RptKeyPair {
  readonly algorithm: "EdDSA";
  readonly keyId: string;
  readonly publicKey: string;
  readonly privateKey: string;
}

export interface SignRptOptions {
  readonly privateKey?: string;
  readonly keyId?: string;
  readonly now?: number;
  readonly header?: Partial<Omit<RptHeader, "alg" | "typ">>;
}

export interface VerifyRptOptions {
  readonly publicKey?: string;
  readonly now?: number;
  readonly maxClockSkewSeconds?: number;
}

let cachedKeyPair: RptKeyPair | undefined;

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + "=".repeat(padding), "base64");
}

function computeKeyId(publicKey: string): string {
  return createHash("sha256").update(publicKey).digest("base64url").slice(0, 16);
}

function ensureKeyPair(): RptKeyPair {
  if (cachedKeyPair) {
    return cachedKeyPair;
  }

  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  cachedKeyPair = {
    algorithm: "EdDSA",
    keyId: computeKeyId(publicKey),
    publicKey,
    privateKey,
  };

  return cachedKeyPair;
}

export function getRptKeyPair(): RptKeyPair {
  return ensureKeyPair();
}

function createSigningInput(header: RptHeader, payload: RptClaims): string {
  const headerJson = JSON.stringify(header);
  const payloadJson = JSON.stringify(payload);
  const encodedHeader = base64UrlEncode(Buffer.from(headerJson));
  const encodedPayload = base64UrlEncode(Buffer.from(payloadJson));
  return `${encodedHeader}.${encodedPayload}`;
}

function buildHeader(options?: SignRptOptions): RptHeader {
  const { keyId, header } = options ?? {};
  const pair = ensureKeyPair();
  return {
    alg: "EdDSA",
    typ: "RPT",
    kid: header?.kid ?? keyId ?? pair.keyId,
  } satisfies RptHeader;
}

function finalizePayload(payload: RptClaims, now: number): RptClaims {
  const nextPayload: RptClaims = {
    ...payload,
    iat: payload.iat ?? now,
  };

  if (typeof nextPayload.iat !== "number" || Number.isNaN(nextPayload.iat)) {
    throw new TypeError("payload.iat must be a number");
  }

  if (nextPayload.exp !== undefined && typeof nextPayload.exp !== "number") {
    throw new TypeError("payload.exp must be a number when provided");
  }

  return nextPayload;
}

export function signRpt(
  payload: Omit<RptClaims, "iat"> & Partial<Pick<RptClaims, "iat">>,
  options: SignRptOptions = {},
): SignedRpt {
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const header = buildHeader(options);
  const pair = ensureKeyPair();
  const privateKeyPem = options.privateKey ?? pair.privateKey;
  const privateKey = createPrivateKey(privateKeyPem);

  const normalizedPayload = finalizePayload(payload as RptClaims, now);
  const signingInput = createSigningInput(header, normalizedPayload);
  const signature = sign(null, Buffer.from(signingInput), privateKey);
  const encodedSignature = base64UrlEncode(signature);
  const token = `${signingInput}.${encodedSignature}`;

  return {
    header,
    payload: normalizedPayload,
    token,
  };
}

export function decodeRpt(token: string): {
  readonly header: RptHeader;
  readonly payload: RptClaims;
  readonly signature: Buffer;
} {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("invalid_rpt_format");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf8")) as RptHeader;
  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as RptClaims;
  const signature = base64UrlDecode(encodedSignature);

  return { header, payload, signature };
}

export function verifyRpt(token: string, options: VerifyRptOptions = {}): RptVerification {
  try {
    const { header, payload, signature } = decodeRpt(token);
    if (header.alg !== "EdDSA" || header.typ !== "RPT") {
      return { valid: false, error: "unsupported_token" };
    }

    const pair = ensureKeyPair();
    const publicKeyPem = options.publicKey ?? pair.publicKey;
    const publicKey = createPublicKey(publicKeyPem);

    const signingInput = createSigningInput(header, payload);
    const isValid = verify(null, Buffer.from(signingInput), publicKey, signature);
    if (!isValid) {
      return { valid: false, error: "invalid_signature" };
    }

    const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
    const skew = options.maxClockSkewSeconds ?? 0;

    if (typeof payload.iat !== "number") {
      return { valid: false, error: "invalid_claims" };
    }

    if (payload.exp !== undefined) {
      if (payload.exp + skew < nowSeconds) {
        return { valid: false, error: "token_expired" };
      }
    }

    if (payload.iat > nowSeconds + skew) {
      return { valid: false, error: "token_issued_in_future" };
    }

    return { valid: true, header, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, error: message };
  }
}
