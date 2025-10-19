import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

const RATE_LIMIT = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;
const BODY_LIMIT_BYTES = 512 * 1024;

const SECURITY_SKIP_PATHS = new Set(["/livez", "/readyz"]);

const securityPlugin = async (app: FastifyInstance): Promise<void> => {
  const allowlistEnv = process.env.CORS_ALLOWLIST ?? "";
  const parsedAllowlist = allowlistEnv
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const hasWildcard = parsedAllowlist.includes("*");
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && hasWildcard) {
    throw new Error("CORS wildcard is not permitted in production environments");
  }

  const allowAllOrigins = !isProduction && hasWildcard;
  const allowlist = allowAllOrigins
    ? parsedAllowlist
    : parsedAllowlist.filter((value) => value !== "*");

  const isOriginAllowed = (origin?: string | null): boolean => {
    if (!origin) {
      return true;
    }

    if (allowAllOrigins) {
      return true;
    }

    return allowlist.includes(origin);
  };

  await app.register(cors, {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      const error = new Error("Origin not allowed");
      (error as any).code = "FST_CORS_ORIGIN_NOT_ALLOWED";
      (error as any).statusCode = 403;
      callback(error);
    },
    methods: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
    preflight: true,
  });

  const clientHits = new Map<string, { count: number; resetAt: number }>();

  app.addHook("onRequest", async (request, reply) => {
    const path = request.raw.url?.split("?")[0] ?? "/";
    if (!SECURITY_SKIP_PATHS.has(path)) {
      const now = Date.now();
      const forwarded = request.headers["x-forwarded-for"];
      const forwardedIp = Array.isArray(forwarded)
        ? forwarded[0]
        : typeof forwarded === "string"
        ? forwarded.split(",")[0].trim()
        : undefined;
      const ip = forwardedIp || request.ip;
      let record = clientHits.get(ip);

      if (!record || record.resetAt <= now) {
        record = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
        clientHits.set(ip, record);
        const timer = setTimeout(() => {
          const existing = clientHits.get(ip);
          if (existing && existing.resetAt <= Date.now()) {
            clientHits.delete(ip);
          }
        }, RATE_LIMIT_WINDOW_MS);
        if (typeof timer.unref === "function") {
          timer.unref();
        }
      } else {
        record.count += 1;
        if (record.count > RATE_LIMIT) {
          const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
          reply.header("Retry-After", retryAfterSeconds.toString());
          await reply.code(429).send({ error: "rate_limit_exceeded" });
          return reply;
        }
      }

      const remaining = Math.max(RATE_LIMIT - record.count, 0);
      reply.header("X-RateLimit-Limit", RATE_LIMIT.toString());
      reply.header("X-RateLimit-Remaining", remaining.toString());
      reply.header("X-RateLimit-Reset", record.resetAt.toString());
    }

    const method = request.raw.method?.toUpperCase();
    if (!method || ["GET", "HEAD", "OPTIONS"].includes(method)) {
      return;
    }

    const contentLengthHeader = request.headers["content-length"];
    if (contentLengthHeader) {
      const parsedLength = Number(contentLengthHeader);
      if (!Number.isNaN(parsedLength) && parsedLength > BODY_LIMIT_BYTES) {
        await reply.code(413).send({ error: "payload_too_large" });
        return reply;
      }
    } else {
      let total = 0;
      const rawRequest = request.raw;

      const handleData = (chunk: Buffer) => {
        total += chunk.length;
        if (total > BODY_LIMIT_BYTES && !reply.sent) {
          rawRequest.off("data", handleData);
          rawRequest.off("end", handleEnd);
          reply.code(413).send({ error: "payload_too_large" });
          rawRequest.destroy();
        }
      };

      const handleEnd = () => {
        rawRequest.off("data", handleData);
        rawRequest.off("end", handleEnd);
      };

      rawRequest.on("data", handleData);
      rawRequest.on("end", handleEnd);
    }
  });
};

export default securityPlugin;
