import { createHmac, createVerify, timingSafeEqual } from "node:crypto";

import type { AuthConfig } from "../config";

const base64UrlEncode = (input: Buffer | string): string => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

const base64UrlDecode = (input: string): Buffer => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : normalized + "=".repeat(4 - padding);
  return Buffer.from(padded, "base64");
};

type JwtHeader = {
  alg: string;
  typ?: string;
};

type JwtPayload = Record<string, unknown>;

const parseSegment = <T>(segment: string): T => {
  const buffer = base64UrlDecode(segment);
  return JSON.parse(buffer.toString("utf8")) as T;
};

const createSignature = (data: string, secret: string): Buffer =>
  createHmac("sha256", secret).update(data).digest();

const verifySignature = (data: string, signature: Buffer, config: AuthConfig, algorithm: string): boolean => {
  if (algorithm === "HS256" && config.type === "secret") {
    const expected = createSignature(data, config.verifyKey);
    if (expected.length !== signature.length) {
      return false;
    }
    return timingSafeEqual(signature, expected);
  }

  if (algorithm === "RS256" && config.type === "public") {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(data);
    verifier.end();
    return verifier.verify(config.verifyKey, signature);
  }

  throw new Error(`Unsupported JWT configuration for algorithm ${algorithm}`);
};

export const verifyJwt = (token: string, config: AuthConfig): JwtPayload => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token structure");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseSegment<JwtHeader>(encodedHeader);
  const payload = parseSegment<JwtPayload>(encodedPayload);
  const signature = base64UrlDecode(encodedSignature);

  if (!header.alg) {
    throw new Error("Missing JWT algorithm");
  }

  const data = `${encodedHeader}.${encodedPayload}`;
  if (!verifySignature(data, signature, config, header.alg)) {
    throw new Error("Invalid signature");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) {
    throw new Error("Token expired");
  }

  if (typeof payload.nbf === "number" && payload.nbf > now) {
    throw new Error("Token not active");
  }

  return payload;
};

export const signJwt = (payload: JwtPayload, secret: string): string => {
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createSignature(data, secret);
  const encodedSignature = base64UrlEncode(signature);
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
};
