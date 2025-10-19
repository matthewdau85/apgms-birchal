import { createPublicKey, createVerify, type JsonWebKey } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  [key: string]: unknown;
};

declare module "fastify" {
  interface FastifyRequest {
    orgId?: string;
    roles: string[];
    tokenPayload?: JwtPayload;
  }
}

const keyCache = new Map<string, ReturnType<typeof createPublicKey>>();
let loadingPromise: Promise<void> | null = null;

async function fetchJwks() {
  const jwksUri = process.env.OIDC_JWKS_URI;
  if (!jwksUri) {
    throw new Error("OIDC_JWKS_URI environment variable is required for JWT verification");
  }

  const res = await fetch(jwksUri);
  if (!res.ok) {
    throw new Error(`Unable to download JWKS: ${res.status} ${res.statusText}`);
  }

  const body = await res.json();
  const keys = Array.isArray(body?.keys) ? (body.keys as JsonWebKey[]) : [];
  keyCache.clear();
  for (const jwk of keys) {
    if (!jwk.kty) {
      continue;
    }
    try {
      const key = createPublicKey({ key: jwk, format: "jwk" });
      keyCache.set(jwk.kid ?? `__default_${keyCache.size}`, key);
    } catch {
      // Ignore invalid keys
    }
  }
}

async function ensureKeys() {
  if (keyCache.size > 0) {
    return;
  }
  if (!loadingPromise) {
    loadingPromise = fetchJwks().finally(() => {
      loadingPromise = null;
    });
  }
  await loadingPromise;
}

async function resolveKey(kid?: string) {
  await ensureKeys();
  let key = kid ? keyCache.get(kid) : keyCache.values().next().value;
  if (!key) {
    await fetchJwks();
    key = kid ? keyCache.get(kid) : keyCache.values().next().value;
  }
  if (!key) {
    throw new Error("No signing keys available");
  }
  return key;
}

function base64UrlToBuffer(segment: string) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const padded = normalized + "=".repeat(pad);
  return Buffer.from(padded, "base64");
}

function parseToken(token: string) {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("Invalid JWT structure");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = JSON.parse(base64UrlToBuffer(encodedHeader).toString("utf8")) as {
    alg: string;
    kid?: string;
  };
  const payload = JSON.parse(base64UrlToBuffer(encodedPayload).toString("utf8")) as JwtPayload;
  const signature = base64UrlToBuffer(encodedSignature);
  return {
    header,
    payload,
    signature,
    signingInput: `${encodedHeader}.${encodedPayload}`,
  };
}

function verifyTimestamps(payload: JwtPayload) {
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now >= payload.exp) {
    throw new Error("Token expired");
  }
  if (typeof payload.nbf === "number" && now < payload.nbf) {
    throw new Error("Token not yet valid");
  }
}

function assertAudience(payload: JwtPayload) {
  const expectedAudience = process.env.OIDC_AUDIENCE;
  if (!expectedAudience) {
    return;
  }
  const { aud } = payload;
  if (Array.isArray(aud)) {
    if (!aud.includes(expectedAudience)) {
      throw new Error("Invalid audience");
    }
    return;
  }
  if (typeof aud === "string") {
    if (aud !== expectedAudience) {
      throw new Error("Invalid audience");
    }
    return;
  }
  throw new Error("Audience missing");
}

function assertIssuer(payload: JwtPayload) {
  const expectedIssuer = process.env.OIDC_ISSUER;
  if (!expectedIssuer) {
    return;
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error("Invalid issuer");
  }
}

function extractOrgId(payload: JwtPayload): string | undefined {
  const direct = payload.orgId ?? (payload as Record<string, unknown>).org_id;
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }
  for (const [key, value] of Object.entries(payload)) {
    if (key.endsWith("/org_id") && typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function extractRoles(payload: JwtPayload): string[] {
  const candidate = (payload as Record<string, unknown>).roles;
  if (Array.isArray(candidate)) {
    return candidate.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof candidate === "string") {
    return candidate.split(/[\s,]+/).filter(Boolean);
  }
  const realmAccess = (payload as Record<string, any>).realm_access;
  if (realmAccess && Array.isArray(realmAccess.roles)) {
    return realmAccess.roles.filter((role: unknown): role is string => typeof role === "string");
  }
  return [];
}

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  req.roles = [];
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }

  try {
    const { header, payload, signature, signingInput } = parseToken(token);
    if (header.alg !== "RS256") {
      throw new Error(`Unsupported JWT algorithm: ${header.alg}`);
    }
    const key = await resolveKey(header.kid);
    const verifier = createVerify("RSA-SHA256");
    verifier.update(signingInput);
    verifier.end();
    const verified = verifier.verify(key, signature);
    if (!verified) {
      throw new Error("JWT signature verification failed");
    }

    verifyTimestamps(payload);
    assertIssuer(payload);
    assertAudience(payload);

    const orgId = extractOrgId(payload);
    if (!orgId) {
      reply.code(403).send({ error: "forbidden" });
      return;
    }

    req.orgId = orgId;
    req.roles = extractRoles(payload);
    req.tokenPayload = payload;
  } catch (error) {
    req.log.warn({ err: error }, "JWT verification failed");
    if (!reply.sent) {
      reply.code(401).send({ error: "unauthorized" });
    }
  }
}
