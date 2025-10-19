import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string;
      orgId: string;
      roles: string[];
    };
  }
}

const verifyJwt = (token: string, secret: string): Record<string, unknown> => {
  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("invalid_token");
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const headerJson = Buffer.from(encodedHeader, "base64url").toString("utf8");
  const header = JSON.parse(headerJson) as { alg?: string };
  if (header.alg !== "HS256") {
    throw new Error("unsupported_algorithm");
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  const provided = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("invalid_signature");
  }

  const payloadJson = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;

  const exp = payload.exp;
  if (typeof exp === "number" && Date.now() >= exp * 1000) {
    throw new Error("token_expired");
  }

  return payload;
};

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  fastify.decorateRequest(
    "user",
    null as unknown as {
      id: string;
      orgId: string;
      roles: string[];
    },
  );

  fastify.addHook("preHandler", async (request, reply) => {
    if (reply.sent) {
      return;
    }

    if (request.method === "OPTIONS") {
      return;
    }

    const url = request.raw.url ?? "";
    if (url.startsWith("/health")) {
      return;
    }

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const token = authorization.slice("Bearer ".length).trim();

    try {
      const payload = verifyJwt(token, secret);
      const sub = payload.sub;
      const orgId = payload.orgId;
      const roles = payload.roles;

      if (typeof sub !== "string" || typeof orgId !== "string") {
        return reply.code(401).send({ error: "unauthorized" });
      }

      request.user = {
        id: sub,
        orgId,
        roles: Array.isArray(roles) ? (roles as string[]) : [],
      };
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });
};

export default authPlugin;
