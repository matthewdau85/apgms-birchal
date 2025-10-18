import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 100;

const securityPlugin: FastifyPluginAsync = async (fastify) => {
  const devOrigins = ["http://localhost:5173"];
  const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isDev = (process.env.NODE_ENV ?? "development").toLowerCase() === "development";
  const allowedOrigins = isDev
    ? devOrigins
    : configuredOrigins.length > 0
      ? configuredOrigins
      : undefined;

  await fastify.register(cors, {
    origin: allowedOrigins ?? false,
    credentials: true,
  });

  const hits = new Map<string, { count: number; expiresAt: number }>();

  fastify.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") {
      return;
    }

    const now = Date.now();
    const ip = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const bucket = hits.get(ip);

    if (!bucket || bucket.expiresAt <= now) {
      hits.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
      return;
    }

    if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
      await reply.code(429).send({ error: "rate_limited" });
      return;
    }

    bucket.count += 1;
  });

  fastify.addHook("onResponse", () => {
    const now = Date.now();
    for (const [ip, bucket] of hits.entries()) {
      if (bucket.expiresAt <= now) {
        hits.delete(ip);
      }
    }
  });
};

export default securityPlugin;
