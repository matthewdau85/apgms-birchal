import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

export interface AuthPayload {
  userId: string;
  orgId: string;
  [key: string]: unknown;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    user?: AuthPayload;
  }

  interface FastifyContextConfig {
    public?: boolean;
  }
}

const base64UrlDecode = (segment: string) => {
  return Buffer.from(segment, "base64url").toString("utf8");
};

const unauthorized = () => {
  const error = new Error("Unauthorized");
  (error as Error & { statusCode: number }).statusCode = 401;
  return error;
};

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }

  fastify.decorateRequest("user", undefined);

  fastify.decorate(
    "authenticate",
    async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw unauthorized();
      }

      const token = authHeader.slice("Bearer ".length).trim();
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw unauthorized();
      }

      const [headerSeg, payloadSeg, signatureSeg] = parts;

      let header: { alg?: string };
      let payload: AuthPayload;

      try {
        header = JSON.parse(base64UrlDecode(headerSeg));
        payload = JSON.parse(base64UrlDecode(payloadSeg));
      } catch (error) {
        request.log.warn({ error }, "Failed to decode JWT segments");
        throw unauthorized();
      }

      if (header.alg !== "HS256") {
        request.log.warn({ alg: header.alg }, "Unsupported JWT algorithm");
        throw unauthorized();
      }

      const expectedSignature = createHmac("sha256", secret)
        .update(`${headerSeg}.${payloadSeg}`)
        .digest("base64url");

      let provided: Buffer;
      let expected: Buffer;
      try {
        provided = Buffer.from(signatureSeg, "base64url");
        expected = Buffer.from(expectedSignature, "base64url");
      } catch (error) {
        request.log.warn({ error }, "Failed to decode JWT signature");
        throw unauthorized();
      }

      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        request.log.warn("JWT signature mismatch");
        throw unauthorized();
      }

      if (
        !payload ||
        typeof payload.userId !== "string" ||
        typeof payload.orgId !== "string"
      ) {
        request.log.warn({ payload }, "JWT payload missing org or user identifiers");
        throw unauthorized();
      }

      request.user = payload;
    }
  );

  fastify.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.config?.public) {
      return;
    }

    await fastify.authenticate(request, reply);
  });
};

export default authPlugin;
