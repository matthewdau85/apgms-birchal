import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHmac } from "node:crypto";

type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  orgId?: string;
  org_id?: string;
  roles?: string[] | string;
  amr?: string[] | string;
  acr?: string;
  [key: string]: unknown;
};

type RequestContext = {
  orgId: string;
  roles: string[];
  mfa: boolean;
};

declare module "fastify" {
  interface FastifyRequest {
    context: RequestContext | null;
  }
}

const NON_PROTECTED_PATHS = new Set(["/healthz", "/readyz"]);

const ensureSecret = () => {
  const secret = process.env.JWT_SHARED_SECRET;
  if (!secret) {
    throw new Error("JWT_SHARED_SECRET is not configured");
  }
  return secret;
};

const issuer = () => {
  const value = process.env.OIDC_ISSUER;
  if (!value) {
    throw new Error("OIDC_ISSUER is not configured");
  }
  return value;
};

const audience = () => {
  const value = process.env.OIDC_AUDIENCE;
  if (!value) {
    throw new Error("OIDC_AUDIENCE is not configured");
  }
  return value;
};

const isAcrMfa = (acr?: string): boolean => {
  if (!acr) return false;
  const match = /^urn:acr:(\d+)fa$/.exec(acr);
  if (!match) return false;
  const level = Number.parseInt(match[1] ?? "0", 10);
  return Number.isFinite(level) && level >= 2;
};

const hasMfa = (payload: JwtPayload): boolean => {
  const amrClaim = payload.amr;
  const amrValues = Array.isArray(amrClaim)
    ? amrClaim.map(String)
    : typeof amrClaim === "string"
    ? amrClaim.split(/[\s,]+/g).map((value) => value.trim()).filter(Boolean)
    : [];
  if (amrValues.some((value) => value.toLowerCase() === "mfa")) {
    return true;
  }
  return isAcrMfa(typeof payload.acr === "string" ? payload.acr : undefined);
};

const extractOrgId = (payload: JwtPayload): string | null => {
  if (typeof payload.orgId === "string" && payload.orgId.length > 0) {
    return payload.orgId;
  }
  if (typeof payload.org_id === "string" && payload.org_id.length > 0) {
    return payload.org_id;
  }
  return null;
};

const extractRoles = (payload: JwtPayload): string[] => {
  const { roles } = payload;
  if (Array.isArray(roles)) {
    return roles.map(String);
  }
  if (typeof roles === "string" && roles.length > 0) {
    return roles
      .split(/[\s,]+/g)
      .map((role) => role.trim())
      .filter(Boolean);
  }
  return [];
};

const unauthorized = (reply: FastifyReply) => {
  reply.code(401).send({ error: "unauthorized" });
};

const forbidden = (reply: FastifyReply) => {
  reply.code(403).send({ error: "forbidden" });
};

const shouldSkip = (request: FastifyRequest) => {
  const url = new URL(request.url, "http://localhost");
  if (NON_PROTECTED_PATHS.has(url.pathname)) {
    return true;
  }
  return false;
};

const decodeBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  return Buffer.from(padded, "base64");
};

const verifyJwt = (
  token: string,
  secretKey: Buffer,
  expectedIssuer: string,
  expectedAudience: string
) => {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("invalid_token");
  }
  const [encodedHeader, encodedPayload, signature] = segments;
  const data = `${encodedHeader}.${encodedPayload}`;
  const computedSignature = createHmac("sha256", secretKey)
    .update(data)
    .digest("base64url");
  if (computedSignature !== signature) {
    throw new Error("invalid_signature");
  }

  const header = JSON.parse(decodeBase64Url(encodedHeader).toString("utf-8"));
  if (header.alg !== "HS256") {
    throw new Error("unsupported_algorithm");
  }

  const payload = JSON.parse(
    decodeBase64Url(encodedPayload).toString("utf-8")
  ) as JwtPayload & { exp?: number; nbf?: number };

  if (payload.iss !== expectedIssuer) {
    throw new Error("invalid_issuer");
  }

  const audClaim = payload.aud;
  const audValid = Array.isArray(audClaim)
    ? audClaim.includes(expectedAudience)
    : audClaim === expectedAudience;
  if (!audValid) {
    throw new Error("invalid_audience");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) {
    throw new Error("token_expired");
  }
  if (typeof payload.nbf === "number" && payload.nbf > now) {
    throw new Error("token_inactive");
  }

  return payload as JwtPayload;
};

export const authPlugin = async (fastify: FastifyInstance) => {
  fastify.decorateRequest("context", null);

  const secretKey = Buffer.from(ensureSecret(), "utf-8");
  const expectedIssuer = issuer();
  const expectedAudience = audience();

  fastify.addHook("preHandler", async (request, reply) => {
    if (shouldSkip(request)) {
      request.context = null;
      return;
    }

    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      unauthorized(reply);
      return reply;
    }

    const token = header.slice("Bearer ".length).trim();
    try {
      const jwtPayload = verifyJwt(token, secretKey, expectedIssuer, expectedAudience);
      const orgId = extractOrgId(jwtPayload);
      if (!orgId) {
        forbidden(reply);
        return reply;
      }
      const roles = extractRoles(jwtPayload);
      const mfa = hasMfa(jwtPayload);

      const url = new URL(request.url, "http://localhost");
      if (url.pathname.startsWith("/admin/") && !mfa) {
        forbidden(reply);
        return reply;
      }

      request.context = { orgId, roles, mfa };
    } catch (error) {
      request.log.warn({ err: error }, "failed to verify jwt");
      unauthorized(reply);
      return reply;
    }
  });
};

export default authPlugin;
