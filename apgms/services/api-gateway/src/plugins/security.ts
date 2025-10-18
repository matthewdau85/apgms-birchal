import cors from "@fastify/cors";
import type { FastifyPluginAsync, RouteOptions } from "fastify";

const defaultBodyLimit = 512 * 1024;
const defaultRateLimitMax = 100;
const defaultRateLimitWindowMs = 60_000;

const normalizePositiveNumber = (
  value: string | number | undefined,
  fallback: number,
): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const securityPlugin: FastifyPluginAsync = async (fastify) => {
  const env = (process.env.NODE_ENV ?? "").toLowerCase();
  const isProduction = env === "production";

  const allowedOriginsCsv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsCsv
    ?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const allowAllOrigins = !allowedOrigins && !isProduction;
  const allowedOriginSet = new Set(allowedOrigins ?? []);

  const isOriginAllowed = (originHeader?: string): boolean => {
    if (!originHeader) {
      return true;
    }

    if (allowAllOrigins) {
      return true;
    }

    return allowedOriginSet.has(originHeader);
  };

  await fastify.register(cors, {
    origin(origin, cb) {
      cb(null, isOriginAllowed(origin ?? undefined));
    },
  });

  const bodyLimit = normalizePositiveNumber(
    process.env.BODY_LIMIT_BYTES,
    defaultBodyLimit,
  );

  fastify.addHook("onRoute", (routeOptions: RouteOptions) => {
    const methodList = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method];

    const shouldApplyLimit = methodList.some((method) => {
      if (!method) {
        return false;
      }

      const upper = method.toUpperCase();
      return upper !== "GET" && upper !== "HEAD" && upper !== "OPTIONS";
    });

    if (!shouldApplyLimit) {
      return;
    }

    routeOptions.config = {
      ...(routeOptions.config ?? {}),
      bodyLimit,
    };

    (routeOptions as RouteOptions & { bodyLimit?: number }).bodyLimit = bodyLimit;
  });

  const rateLimitMax = normalizePositiveNumber(
    process.env.RATE_LIMIT_MAX,
    defaultRateLimitMax,
  );
  const rateLimitWindowMs = normalizePositiveNumber(
    process.env.RATE_LIMIT_WINDOW_MS,
    defaultRateLimitWindowMs,
  );

  const buckets = new Map<string, { count: number; reset: number }>();

  fastify.addHook("onRequest", async (request, reply) => {
    const now = Date.now();
    const ip = request.ip || request.socket.remoteAddress || "unknown";
    const existing = buckets.get(ip);

    if (!existing || now >= existing.reset) {
      buckets.set(ip, { count: 1, reset: now + rateLimitWindowMs });
    } else if (existing.count >= rateLimitMax) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.reset - now) / 1000),
      );

      return reply
        .header("Retry-After", retryAfterSeconds.toString())
        .code(429)
        .send({ error: "too_many_requests" });
    } else {
      existing.count += 1;
    }

    if (!isOriginAllowed(request.headers.origin ?? undefined)) {
      return reply.code(403).send({ error: "origin_not_allowed" });
    }

    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      const contentLengthHeader = request.headers["content-length"];
      if (Array.isArray(contentLengthHeader)) {
        const parsed = contentLengthHeader
          .map((value) => Number(value))
          .find((value) => Number.isFinite(value));
        if (parsed !== undefined && parsed > bodyLimit) {
          return reply.code(413).send({ error: "payload_too_large" });
        }
      } else if (contentLengthHeader) {
        const parsed = Number(contentLengthHeader);
        if (Number.isFinite(parsed) && parsed > bodyLimit) {
          return reply.code(413).send({ error: "payload_too_large" });
        }
      }
    }
  });
};

export default securityPlugin;
