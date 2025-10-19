import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    corsAllowedOrigin?: string | null;
  }
}

const standardHeaders: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-xss-protection": "0",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "content-security-policy": "default-src 'self'",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
};

const securityPlugin: FastifyPluginAsync = async (fastify) => {
  const allowList = new Set(
    (process.env.CORS_ALLOW_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );

  const maxRequests = process.env.NODE_ENV === "production" ? 60 : 100;
  const rateLimitWindowMs = 60_000;
  const counters = new Map<string, { count: number; resetAt: number }>();

  fastify.decorateRequest("corsAllowedOrigin", null as string | null | undefined);

  fastify.addHook("onRequest", async (request, reply) => {
    const originHeader = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
    if (originHeader) {
      reply.header("vary", "Origin");
    }
    if (originHeader && allowList.has(originHeader)) {
      request.corsAllowedOrigin = originHeader;
    } else if (!originHeader) {
      request.corsAllowedOrigin = null;
    } else {
      request.corsAllowedOrigin = undefined;
    }

    if (request.method === "OPTIONS") {
      if (request.corsAllowedOrigin === undefined && originHeader) {
        reply.header("vary", "Origin");
        return reply.code(403).send();
      }

      if (request.corsAllowedOrigin) {
        reply.header("access-control-allow-origin", request.corsAllowedOrigin);
        reply.header("vary", "Origin");
      }
      reply.header("access-control-allow-methods", request.headers["access-control-request-method"] ?? "GET,POST,PUT,DELETE,OPTIONS");
      const requestHeaders = request.headers["access-control-request-headers"];
      if (typeof requestHeaders === "string") {
        reply.header("access-control-allow-headers", requestHeaders);
      }
      reply.header("access-control-max-age", "600");
      return reply.code(204).send();
    }

    if ((request.raw.url ?? "").startsWith("/health")) {
      return;
    }

    if (request.corsAllowedOrigin === undefined && originHeader) {
      reply.header("vary", "Origin");
      return reply.code(403).send({ error: "forbidden" });
    }

    const key = request.ip;
    const now = Date.now();
    const bucket = counters.get(key);
    if (!bucket || bucket.resetAt <= now) {
      counters.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
      return;
    }

    if (bucket.count >= maxRequests) {
      return reply.code(429).send({ error: "rate_limited" });
    }

    bucket.count += 1;
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    if (request.corsAllowedOrigin) {
      reply.header("access-control-allow-origin", request.corsAllowedOrigin);
      reply.header("vary", "Origin");
      reply.header("access-control-allow-credentials", "true");
    } else if (request.corsAllowedOrigin === null) {
      reply.header("vary", "Origin");
    }

    for (const [header, value] of Object.entries(standardHeaders)) {
      if (!reply.hasHeader(header)) {
        reply.header(header, value);
      }
    }

    return payload;
  });
};

export default securityPlugin;
