import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { z } from "zod";
import { getRequestOrgId } from "./org-scope";

const roleSchema = z.enum(["admin", "operator", "viewer"]);
const payloadSchema = z.object({
  sub: z.string(),
  orgId: z.string(),
  roles: z.array(roleSchema),
});

type Role = z.infer<typeof roleSchema>;

type JwtPayload = z.infer<typeof payloadSchema>;

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function verifyJwt(token: string, secret: string): JwtPayload {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("invalid_token");
  }
  const [encodedHeader, encodedPayload, signature] = segments;
  const headerJson = base64UrlDecode(encodedHeader);
  const payloadJson = base64UrlDecode(encodedPayload);

  const header = JSON.parse(headerJson) as { alg?: string; typ?: string };
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error("unsupported_token");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  const providedSignature = Buffer.from(signature, "base64url");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");

  if (
    providedSignature.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignatureBuffer)
  ) {
    throw new Error("invalid_signature");
  }

  return payloadSchema.parse(JSON.parse(payloadJson));
}

export async function verifyAuth(req: FastifyRequest, reply: FastifyReply) {
  if (req.routerPath === "/healthz") {
    return;
  }

  const authorization = req.headers.authorization ?? req.headers.Authorization;
  if (!authorization || typeof authorization !== "string") {
    return reply.code(401).send({ error: "unauthorized" });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) {
    return reply.code(401).send({ error: "unauthorized" });
  }

  const token = match[1];
  const secret = process.env.AUTH_SECRET ?? "dev-secret";

  try {
    const payload = verifyJwt(token, secret);
    req.user = payload;
  } catch (error) {
    req.log.warn({ err: error }, "invalid jwt");
    return reply.code(401).send({ error: "unauthorized" });
  }
}

export function requireRole(role: Role): preHandlerHookHandler {
  return async (req, reply) => {
    const user = req.user;
    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (!user.roles.includes(role) && !user.roles.includes("admin")) {
      return reply.code(403).send({ error: "forbidden" });
    }
  };
}

export function requireOrg(): preHandlerHookHandler {
  return async (req, reply) => {
    const user = req.user;
    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const requestOrgId = getRequestOrgId(req);
    if (!requestOrgId) {
      return reply.code(400).send({ error: "org_required" });
    }

    if (requestOrgId !== user.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }
  };
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}
