import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export type AuthUser = {
  userId: string;
  orgId: string;
  roles: string[];
};

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser;
  }
}

function parseRoles(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((role) => String(role)).filter(Boolean);
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

function verifyJwtToken(
  authorization: string,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply | void {
  const issuer = process.env.AUTH_ISSUER;
  const audience = process.env.AUTH_AUDIENCE;
  const secret = process.env.AUTH_SECRET;

  if (!issuer || !audience || !secret) {
    request.log.error("AUTH_ISSUER, AUTH_AUDIENCE, and AUTH_SECRET must be configured");
    return reply.code(500).send({ error: "auth_not_configured" });
  }

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  const token = authorization.slice(7).trim();
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    if (header.alg !== "HS256") {
      request.log.error({ alg: header.alg }, "Unsupported JWT algorithm");
      return reply.code(401).send({ error: "unauthorized" });
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

    const signature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();

    if (signature.length !== expectedSignature.length || !timingSafeEqual(signature, expectedSignature)) {
      request.log.error("JWT signature mismatch");
      return reply.code(401).send({ error: "unauthorized" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) {
      request.log.error({ exp: payload.exp, now }, "JWT expired");
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (payload.iss !== issuer) {
      request.log.error({ iss: payload.iss }, "JWT issuer mismatch");
      return reply.code(401).send({ error: "unauthorized" });
    }

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.some((aud) => aud === audience)) {
      request.log.error({ aud: payload.aud }, "JWT audience mismatch");
      return reply.code(401).send({ error: "unauthorized" });
    }

    const userId = typeof payload.sub === "string" ? payload.sub : undefined;
    const orgId = typeof payload.orgId === "string" ? payload.orgId : undefined;
    const roles = parseRoles(payload.roles);

    if (!userId || !orgId) {
      request.log.error({ payload }, "JWT missing required claims");
      return reply.code(401).send({ error: "unauthorized" });
    }

    request.user = { userId, orgId, roles };
  } catch (error) {
    request.log.error({ error }, "JWT verification failed");
    return reply.code(401).send({ error: "unauthorized" });
  }
}

function verifyBypassHeaders(request: FastifyRequest, reply: FastifyReply) {
  const devUser = request.headers["x-dev-user"];
  const devOrg = request.headers["x-dev-org"];
  const devRoles = request.headers["x-dev-roles"];

  if (!devUser || !devOrg) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  request.user = {
    userId: String(devUser),
    orgId: String(devOrg),
    roles: parseRoles(devRoles),
  };
}

export function verifyBearer() {
  return async function verify(request: FastifyRequest, reply: FastifyReply) {
    if (process.env.AUTH_BYPASS === "true") {
      return verifyBypassHeaders(request, reply);
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    return verifyJwtToken(authorization, request, reply);
  };
}

export function requireRole(...roles: string[]) {
  const required = new Set(roles);

  return async function enforce(request: FastifyRequest, reply: FastifyReply) {
    const userRoles = request.user?.roles ?? [];
    const hasRole = userRoles.some((role) => required.has(role));

    if (!hasRole) {
      return reply.code(403).send({ error: "forbidden" });
    }
  };
}
