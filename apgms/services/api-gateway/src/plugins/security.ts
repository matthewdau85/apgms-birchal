import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";

const DEV_DEFAULT_ORIGINS = ["http://localhost:3000"];

const parseCsvList = (value?: string): string[] =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

const securityPlugin: FastifyPluginAsync = async (fastify) => {
  const env = process.env.NODE_ENV ?? "development";
  let allowedOrigins = parseCsvList(process.env.ALLOWED_ORIGINS);

  if (env === "production" && allowedOrigins.length === 0) {
    throw new Error("ALLOWED_ORIGINS must be provided in production");
  }

  if (allowedOrigins.length === 0) {
    allowedOrigins = DEV_DEFAULT_ORIGINS;
  }

  const allowList = new Set(allowedOrigins);

  const maxRequestsPerMinute = parsePositiveInteger(process.env.RATE_LIMIT_RPM, 100);
  const timeWindowMs = 60_000;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  fastify.addHook("onRequest", async (request, reply) => {
    const originHeader = request.headers.origin;
    if (originHeader && !allowList.has(originHeader)) {
      await reply.code(403).send({ error: "forbidden_origin" });
      return reply;
    }

    if (maxRequestsPerMinute <= 0) {
      return;
    }

    const now = Date.now();
    const ip = request.ip || request.socket.remoteAddress || "unknown";
    const bucket = buckets.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + timeWindowMs });
      return;
    }

    bucket.count += 1;
    if (bucket.count > maxRequestsPerMinute) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      reply.header("retry-after", retryAfterSeconds);
      await reply.code(429).send({ error: "rate_limit_exceeded" });
      return reply;
    }
  });

  fastify.addHook("onClose", () => {
    buckets.clear();
  });

  await fastify.register(cors, {
    origin(origin, cb) {
      if (!origin) {
        cb(null, true);
        return;
      }

      if (allowList.has(origin)) {
        cb(null, true);
        return;
      }

      const error = new Error("Origin not allowed");
      (error as Error & { statusCode?: number }).statusCode = 403;
      cb(error);
    },
  });

  const bodyLimit = parsePositiveInteger(process.env.BODY_LIMIT_BYTES, 512 * 1024);

  fastify.removeContentTypeParser("application/json");
  fastify.removeContentTypeParser("application/json; charset=utf-8");

  fastify.addContentTypeParser(
    /^application\/(.+\+)?json$/,
    { parseAs: "string", bodyLimit },
    fastify.getDefaultJsonParser("error", "ignore"),
  );
};

(securityPlugin as Record<string | symbol, unknown>)[Symbol.for("skip-override")] = true;

export default securityPlugin;
