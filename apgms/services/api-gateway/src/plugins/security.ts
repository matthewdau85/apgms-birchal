import cors from "@fastify/cors";
import { FastifyInstance } from "fastify";

const BODY_LIMIT = 512 * 1024;
const RATE_LIMIT = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function parseAllowlist(): string[] {
  const raw = process.env.CORS_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

async function securityPlugin(app: FastifyInstance) {
  const allowlist = parseAllowlist();
  const isOriginAllowed = (origin: string) =>
    allowlist.length > 0 && allowlist.includes(origin);
  const rateWindow = new Map<
    string,
    {
      count: number;
      expiresAt: number;
    }
  >();

  await app.register(cors, {
    origin(origin, cb) {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (isOriginAllowed(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    credentials: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/healthz") || request.url.startsWith("/readyz")) {
      return;
    }
    const originHeader = request.headers.origin;
    if (originHeader) {
      const originValue = Array.isArray(originHeader) ? originHeader[0] : originHeader;
      if (!isOriginAllowed(originValue)) {
        if (request.method === "OPTIONS") {
          return reply.code(403).send({ error: "cors_not_allowed" });
        }
      }
    }
    const forwardedFor = request.headers["x-forwarded-for"];
    const realIp = request.headers["x-real-ip"];
    const headerIp = Array.isArray(realIp)
      ? realIp[0]
      : typeof realIp === "string"
        ? realIp
        : Array.isArray(forwardedFor)
          ? forwardedFor[0]
          : typeof forwardedFor === "string"
            ? forwardedFor.split(",")[0].trim()
            : undefined;
    const key = headerIp && headerIp.length > 0 ? headerIp : request.ip;
    const now = Date.now();
    const record = rateWindow.get(key);
    if (!record || record.expiresAt <= now) {
      rateWindow.set(key, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
      return;
    }
    record.count += 1;
    rateWindow.set(key, record);
    if (record.count > RATE_LIMIT) {
      return reply.code(429).send({ error: "rate_limit_exceeded" });
    }
  });

  app.addHook("onRoute", (routeOptions) => {
    if (!routeOptions.bodyLimit || routeOptions.bodyLimit > BODY_LIMIT) {
      routeOptions.bodyLimit = BODY_LIMIT;
    }
  });

  app.addHook("onClose", () => {
    rateWindow.clear();
  });
}

export async function registerSecurity(app: FastifyInstance) {
  await securityPlugin(app);
}
