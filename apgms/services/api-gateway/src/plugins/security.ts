import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";

const defaultAllowlist = ["http://localhost:5173"];
const parseAllowlist = (value?: string | null) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const securityPlugin: FastifyPluginAsync = async (fastify) => {
  const allowlist = parseAllowlist(process.env.CORS_ALLOWLIST) ?? defaultAllowlist;
  const allowedOrigins = new Set(allowlist);

  const rateLimitRpm = Number(process.env.RATE_LIMIT_RPM ?? 100);
  const maxRequests = Number.isFinite(rateLimitRpm) && rateLimitRpm > 0 ? rateLimitRpm : 100;
  const rateLimitWindowMs = 60_000;
  const rateLimitStore = new Map<
    string,
    {
      count: number;
      resetAt: number;
    }
  >();

  const bodyLimitKb = Number(process.env.BODY_LIMIT_KB ?? 512);
  const bodyLimit = (Number.isFinite(bodyLimitKb) && bodyLimitKb > 0 ? bodyLimitKb : 512) * 1024;

  fastify.addHook("onRequest", async (request, reply) => {
    const originHeader = request.headers.origin;
    if (originHeader && !allowedOrigins.has(originHeader)) {
      return reply.code(403).send({ error: "forbidden_origin" });
    }
  });

  fastify.addHook("preHandler", async (request, reply) => {
    const forwarded = request.headers["x-forwarded-for"];
    const rawIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = rawIp ? rawIp.split(",")[0].trim() : request.ip;
    const orgIdHeader = request.headers["x-org-id"];
    const orgId = Array.isArray(orgIdHeader) ? orgIdHeader[0] : orgIdHeader;
    const key = orgId ? `${ip}:${orgId}` : ip;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
      return;
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      reply.header("retry-after", retryAfter);
      return reply.code(429).send({ error: "rate_limit_exceeded" });
    }

    entry.count += 1;
    rateLimitStore.set(key, entry);
  });

  await fastify.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 200,
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.has(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
  });

  fastify.addHook("onRoute", (routeOptions) => {
    if (!routeOptions.bodyLimit || routeOptions.bodyLimit > bodyLimit) {
      routeOptions.bodyLimit = bodyLimit;
    }
  });

  fastify.addHook("onClose", () => {
    rateLimitStore.clear();
  });
};

const pluginMeta = { name: "security", encapsulate: false } as const;
(securityPlugin as any)[Symbol.for("skip-override")] = true;
(securityPlugin as any)[Symbol.for("fastify.display-name")] = pluginMeta.name;
(securityPlugin as any)[Symbol.for("plugin-meta")] = pluginMeta;
(securityPlugin as any).default = securityPlugin;

export default securityPlugin;
