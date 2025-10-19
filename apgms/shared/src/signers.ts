import { createPrivateKey, createPublicKey, createSign, createVerify, KeyObject } from "node:crypto";

export type SupportedAlgorithms = "RS256" | "RS384" | "RS512";

export interface RawSignerConfig {
  kid: string;
  privateKey: string;
  publicKey: string;
  alg?: SupportedAlgorithms;
}

export interface JWTPayload {
  [key: string]: unknown;
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
}

export interface SignJwtOptions {
  audience?: string | string[];
  expiresIn?: string | number;
  issuer?: string;
  subject?: string;
  notBefore?: string | number;
}

export interface VerifyJwtOptions {
  audience?: string | string[];
  issuer?: string;
  subject?: string;
  clockTolerance?: number;
}

export interface JwtHeader {
  alg: SupportedAlgorithms;
  kid: string;
  typ: "JWT";
}

export interface JwtVerifyResult<T extends JWTPayload> {
  payload: T;
  protectedHeader: JwtHeader;
}

export interface Signer {
  kid: string;
  algorithm: SupportedAlgorithms;
  sign<T extends JWTPayload>(payload: T, options?: SignJwtOptions): Promise<string>;
  verify<T extends JWTPayload>(token: string, options?: VerifyJwtOptions): Promise<JwtVerifyResult<T>>;
}

const signerCache = new Map<string, Promise<Signer>>();

export function clearSignerCache(name?: string) {
  if (name) {
    signerCache.delete(name);
    return;
  }
  signerCache.clear();
}

const SIGN_ALGORITHMS: Record<SupportedAlgorithms, string> = {
  RS256: "RSA-SHA256",
  RS384: "RSA-SHA384",
  RS512: "RSA-SHA512",
};

function parseDuration(input: string | number): number {
  if (typeof input === "number") {
    return input;
  }
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) {
    throw new Error(`Unsupported duration format: ${input}`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multiplier[unit];
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(segment: string): Buffer {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad === 0 ? normalized : normalized + "=".repeat(4 - pad);
  return Buffer.from(padded, "base64");
}

function isAudienceMatch(expected: string | string[], actual?: string | string[]): boolean {
  if (expected === undefined) {
    return true;
  }
  const expectedSet = Array.isArray(expected) ? expected : [expected];
  const actualSet = actual === undefined ? [] : Array.isArray(actual) ? actual : [actual];
  return expectedSet.every((entry) => actualSet.includes(entry));
}

function assertClaim(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function buildSigner(name: string): Promise<Signer> {
  const envKey = `${name.toUpperCase()}_PRIVATE_KEYS`;
  const envValue = process.env[envKey];

  if (!envValue) {
    throw new Error(`Missing environment variable ${envKey} for signer "${name}"`);
  }

  let rawConfigs: RawSignerConfig[];
  try {
    rawConfigs = JSON.parse(envValue) as RawSignerConfig[];
  } catch (error) {
    throw new Error(`Failed to parse ${envKey} as JSON array: ${(error as Error).message}`);
  }

  if (!Array.isArray(rawConfigs) || rawConfigs.length === 0) {
    throw new Error(`${envKey} must be a non-empty JSON array`);
  }

  const configs = rawConfigs.map((config) => {
    if (!config || typeof config !== "object") {
      throw new Error(`${envKey} entries must be objects`);
    }
    if (!config.kid || !config.privateKey || !config.publicKey) {
      throw new Error(`${envKey} entries must include kid, privateKey and publicKey`);
    }
    const algorithm = config.alg ?? "RS256";
    if (!(algorithm in SIGN_ALGORITHMS)) {
      throw new Error(`Unsupported algorithm ${algorithm} for signer "${name}"`);
    }
    return {
      kid: config.kid,
      privateKey: createPrivateKey(config.privateKey),
      publicKey: createPublicKey(config.publicKey),
      alg: algorithm as SupportedAlgorithms,
    };
  });

  const [active, ...rest] = configs;
  const verificationEntries = [active, ...rest];
  const verificationMap = new Map<string, KeyObject>();

  for (const entry of verificationEntries) {
    if (!verificationMap.has(entry.kid)) {
      verificationMap.set(entry.kid, entry.publicKey);
    }
  }

  const resolveVerificationKey = (kid?: string): KeyObject => {
    const effectiveKid = kid ?? active.kid;
    const key = verificationMap.get(effectiveKid);
    if (!key) {
      throw new Error(`Unknown key id "${effectiveKid}" for signer "${name}"`);
    }
    return key;
  };

  return {
    kid: active.kid,
    algorithm: active.alg,
    async sign<T extends JWTPayload>(payload: T, options: SignJwtOptions = {}) {
      const claims: JWTPayload = { ...payload };
      const now = Math.floor(Date.now() / 1000);

      if (claims.iat === undefined) {
        claims.iat = now;
      }
      if (options.expiresIn !== undefined) {
        claims.exp = now + parseDuration(options.expiresIn);
      }
      if (options.audience !== undefined) {
        claims.aud = options.audience;
      }
      if (options.issuer !== undefined) {
        claims.iss = options.issuer;
      }
      if (options.subject !== undefined) {
        claims.sub = options.subject;
      }
      if (options.notBefore !== undefined) {
        claims.nbf = now + parseDuration(options.notBefore);
      }

      const header: JwtHeader = { alg: active.alg, kid: active.kid, typ: "JWT" };
      const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
      const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(claims)));
      const signingInput = `${encodedHeader}.${encodedPayload}`;

      const signer = createSign(SIGN_ALGORITHMS[active.alg]);
      signer.update(signingInput);
      signer.end();
      const signature = signer.sign(active.privateKey);
      const encodedSignature = base64UrlEncode(signature);

      return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
    },
    async verify<T extends JWTPayload>(token: string, options: VerifyJwtOptions = {}) {
      const segments = token.split(".");
      assertClaim(segments.length === 3, "Token must have three segments");

      const [encodedHeader, encodedPayload, encodedSignature] = segments;
      const header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf8")) as JwtHeader;
      assertClaim(header.alg in SIGN_ALGORITHMS, "Unsupported algorithm in token");

      const signingInput = `${encodedHeader}.${encodedPayload}`;
      const verifier = createVerify(SIGN_ALGORITHMS[header.alg]);
      verifier.update(signingInput);
      verifier.end();
      const signatureValid = verifier.verify(resolveVerificationKey(header.kid), base64UrlDecode(encodedSignature));
      assertClaim(signatureValid, "Invalid token signature");

      const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as T;
      const now = Math.floor(Date.now() / 1000);
      const tolerance = options.clockTolerance ?? 0;

      if (payload.exp !== undefined) {
        assertClaim(now <= payload.exp + tolerance, "Token has expired");
      }
      if (payload.nbf !== undefined) {
        assertClaim(now >= payload.nbf - tolerance, "Token not yet valid");
      }
      if (options.issuer !== undefined) {
        assertClaim(payload.iss === options.issuer, "Issuer mismatch");
      }
      if (options.subject !== undefined) {
        assertClaim(payload.sub === options.subject, "Subject mismatch");
      }
      if (options.audience !== undefined) {
        assertClaim(isAudienceMatch(options.audience, payload.aud), "Audience mismatch");
      }

      return { payload, protectedHeader: header } satisfies JwtVerifyResult<T>;
    },
  } satisfies Signer;
}

export async function getSigner(name: string): Promise<Signer> {
  if (!signerCache.has(name)) {
    signerCache.set(name, buildSigner(name));
  }
  return signerCache.get(name)!;
}
