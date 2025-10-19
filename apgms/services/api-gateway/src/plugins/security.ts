import cors from "@fastify/cors";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

const BODY_LIMIT_BYTES = 512 * 1024;
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const securityPlugin: FastifyPluginAsync = async (fastify) => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  await fastify.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  const buckets = new Map<string, RateLimitBucket>();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, RATE_LIMIT_WINDOW_MS);
  cleanupInterval.unref?.();

  const rateLimitKey = (request: FastifyRequest) => {
    const route = request.routerPath ?? request.routeOptions.url ?? request.raw.url ?? "unknown";
    return `${request.ip}:${request.method}:${route}`;
  };

  fastify.addHook("preHandler", async (request, reply) => {
    const now = Date.now();
    const key = rateLimitKey(request);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return;
    }

    bucket.count += 1;

    if (bucket.count > RATE_LIMIT_MAX) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      reply.header("Retry-After", String(retryAfterSeconds));
      reply.code(429);
      await reply.send({ error: "rate_limit_exceeded" });
      return reply;
    }
  });

  fastify.addHook("onRoute", (routeOptions) => {
    routeOptions.bodyLimit = routeOptions.bodyLimit === undefined
      ? BODY_LIMIT_BYTES
      : Math.min(routeOptions.bodyLimit, BODY_LIMIT_BYTES);
  });

  fastify.addHook("onClose", async () => {
    clearInterval(cleanupInterval);
    buckets.clear();
  });
};

const wrapAsFastifyPlugin = <T extends FastifyPluginAsync>(plugin: T, name: string): T => {
  const skipOverride = Symbol.for("skip-override");
  const displayName = Symbol.for("fastify.display-name");
  (plugin as any)[skipOverride] = true;
  (plugin as any)[displayName] = name;
  return plugin;
};

export default wrapAsFastifyPlugin(securityPlugin, "security");
