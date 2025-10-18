import cors from "@fastify/cors";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const ONE_MINUTE_MS = 60_000;
const DEFAULT_DEV_ORIGIN = "http://localhost:3000";

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const parseAllowedOrigins = (envValue: string | undefined, nodeEnv: string): string[] => {
  if (envValue && envValue.trim().length > 0) {
    return envValue
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  if (nodeEnv !== "production") {
    return [DEFAULT_DEV_ORIGIN];
  }

  return [];
};

const isPayloadTooLarge = (request: FastifyRequest, bodyLimit: number): boolean => {
  if (bodyLimit <= 0) {
    return false;
  }

  const contentLengthHeader = request.headers["content-length"];
  if (!contentLengthHeader) {
    return false;
  }

  const length = Number.parseInt(Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader, 10);

  return Number.isFinite(length) && length > bodyLimit;
};

const applyRateLimit = (
  rateLimitState: Map<string, { count: number; resetAt: number }>,
  request: FastifyRequest,
  limit: number,
): boolean => {
  if (limit <= 0) {
    return false;
  }

  const now = Date.now();
  const ip = request.ip;
  const existing = rateLimitState.get(ip);

  if (!existing || existing.resetAt <= now) {
    rateLimitState.set(ip, { count: 1, resetAt: now + ONE_MINUTE_MS });
    return false;
  }

  if (existing.count + 1 > limit) {
    return true;
  }

  existing.count += 1;
  rateLimitState.set(ip, existing);

  if (rateLimitState.size > 1000) {
    for (const [key, value] of rateLimitState) {
      if (value.resetAt <= now) {
        rateLimitState.delete(key);
      }
    }
  }

  return false;
};

const denyRequest = (reply: FastifyReply, statusCode: number, error: string) => {
  return reply.code(statusCode).send({ error });
};

const security = async (app: FastifyInstance) => {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS, nodeEnv);
  const rateLimitRpm = parsePositiveInteger(process.env.RATE_LIMIT_RPM, 100);
  const bodyLimitBytes = parsePositiveInteger(process.env.BODY_LIMIT_BYTES, 512 * 1024);
  const rateLimitState = new Map<string, { count: number; resetAt: number }>();

  await app.register(cors, {
    preflight: true,
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0) {
        callback(null, false);
        return;
      }

      const isAllowed = allowedOrigins.some((allowed) => allowed === "*" || allowed === origin);
      callback(null, isAllowed);
    },
  });

  app.addHook("onRequest", async (request, reply) => {
    if (isPayloadTooLarge(request, bodyLimitBytes)) {
      return denyRequest(reply, 413, "payload_too_large");
    }

    if (applyRateLimit(rateLimitState, request, rateLimitRpm)) {
      return denyRequest(reply, 429, "rate_limit_exceeded");
    }

    return undefined;
  });

  app.addHook("onClose", () => {
    rateLimitState.clear();
  });
};

(security as any)[Symbol.for("skip-override")] = true;
(security as any)[Symbol.for("skip-encapsulation")] = true;

export default security;
