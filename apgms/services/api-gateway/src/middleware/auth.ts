import crypto from "node:crypto";
import { FastifyReply, FastifyRequest, PreHandlerHookHandler } from "fastify";

const MFA_MIN_ACR = "urn:mfa";

export interface AuthContext {
  sub: string;
  org: string;
  email?: string;
  amr?: string[];
  acr?: string;
  token: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

type JwtHeader = {
  alg: string;
  typ?: string;
  kid?: string;
};

type JwtPayload = {
  sub?: unknown;
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
  iat?: unknown;
  email?: unknown;
  org?: unknown;
  orgId?: unknown;
  [key: string]: unknown;
};

function normalizeOrgClaim(payload: JwtPayload): string | undefined {
  const orgCandidates = [payload.org, payload.orgId, payload["https://apgms.io/org"]];
  for (const candidate of orgCandidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return undefined;
}

function buildVerificationOptions() {
  return {
    issuer: process.env.OIDC_ISSUER,
    audience: process.env.OIDC_AUDIENCE,
  };
}

function resolveSecret(): Buffer {
  const secret = process.env.JWT_SECRET ?? "dev-secret";
  return Buffer.from(secret, "utf8");
}

function decodeSegment(segment: string): Buffer {
  return Buffer.from(segment, "base64url");
}

function parseHeader(segment: string): JwtHeader {
  try {
    const header = JSON.parse(decodeSegment(segment).toString("utf8")) as JwtHeader;
    if (!header || typeof header.alg !== "string") {
      throw new Error("invalid_header");
    }
    return header;
  } catch (error) {
    throw new Error("invalid_header");
  }
}

function parsePayload(segment: string): JwtPayload {
  try {
    return JSON.parse(decodeSegment(segment).toString("utf8")) as JwtPayload;
  } catch (error) {
    throw new Error("invalid_payload");
  }
}

function verifySignature(input: string, signature: string, secret: Buffer) {
  const expected = crypto.createHmac("sha256", secret).update(input).digest();
  const provided = Buffer.from(signature, "base64url");
  if (expected.length !== provided.length) {
    throw new Error("invalid_signature");
  }
  if (!crypto.timingSafeEqual(expected, provided)) {
    throw new Error("invalid_signature");
  }
}

function assertTemporalClaims(payload: JwtPayload) {
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now >= payload.exp) {
    throw new Error("token_expired");
  }
  if (typeof payload.nbf === "number" && now < payload.nbf) {
    throw new Error("token_not_active");
  }
}

function assertIssuer(payload: JwtPayload, issuer?: string) {
  if (!issuer) {
    return;
  }
  if (payload.iss !== issuer) {
    throw new Error("invalid_issuer");
  }
}

function assertAudience(payload: JwtPayload, audience?: string) {
  if (!audience) {
    return;
  }
  const claim = payload.aud;
  if (typeof claim === "string" && claim === audience) {
    return;
  }
  if (Array.isArray(claim) && claim.includes(audience)) {
    return;
  }
  throw new Error("invalid_audience");
}

async function verifyAccessToken(token: string): Promise<AuthContext> {
  const secret = resolveSecret();
  const options = buildVerificationOptions();
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("malformed_token");
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const header = parseHeader(encodedHeader);
  if (header.alg !== "HS256") {
    throw new Error("unsupported_algorithm");
  }

  verifySignature(`${encodedHeader}.${encodedPayload}`, signature, secret);
  const payload = parsePayload(encodedPayload);

  assertTemporalClaims(payload);
  assertIssuer(payload, options.issuer);
  assertAudience(payload, options.audience);

  const sub = typeof payload.sub === "string" ? payload.sub : undefined;
  const org = normalizeOrgClaim(payload);

  if (!sub) {
    throw new Error("token_missing_sub");
  }
  if (!org) {
    throw new Error("token_missing_org");
  }

  const amr = Array.isArray(payload.amr)
    ? payload.amr.filter((value): value is string => typeof value === "string")
    : undefined;

  const acr = typeof payload.acr === "string" ? payload.acr : undefined;
  const email = typeof payload.email === "string" ? payload.email : undefined;

  return {
    sub,
    org,
    email,
    amr,
    acr,
    token,
  };
}

function unauthorized(rep: FastifyReply) {
  void rep.code(401).send({ error: "unauthorized" });
}

function forbidden(rep: FastifyReply) {
  void rep.code(403).send({ error: "mfa_required" });
}

function hasMfaContext(auth: AuthContext): boolean {
  if (auth.amr && auth.amr.some((value) => typeof value === "string" && value.toLowerCase() === "mfa")) {
    return true;
  }
  if (auth.acr) {
    const normalized = auth.acr.toLowerCase();
    if (normalized === MFA_MIN_ACR) {
      return true;
    }
    if (normalized.localeCompare(MFA_MIN_ACR, undefined, { sensitivity: "base" }) >= 0) {
      return true;
    }
  }
  return false;
}

export const requireMFA: PreHandlerHookHandler = async (req: FastifyRequest, rep: FastifyReply) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
    unauthorized(rep);
    return;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    unauthorized(rep);
    return;
  }

  let auth: AuthContext;
  try {
    auth = await verifyAccessToken(token);
  } catch (error) {
    req.log.warn({ err: error }, "JWT verification failed");
    unauthorized(rep);
    return;
  }

  if (!hasMfaContext(auth)) {
    forbidden(rep);
    return;
  }

  req.auth = auth;
};

export { verifyAccessToken };
