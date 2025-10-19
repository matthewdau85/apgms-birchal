import fp from "fastify-plugin";
import type { FastifyReply } from "fastify";

const IDEMPOTENCY_PREFIX = "idempotency";
const LOCK_PREFIX = "idempotency-lock";
const LOCK_TTL_SECONDS = 60;
const CACHE_TTL_SECONDS = 60 * 60 * 24;

interface StoredResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  contentType?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    idempotencyKey?: string;
  }
}

async function replayResponse(reply: FastifyReply, stored: StoredResponse) {
  reply.header("idempotency-replayed", "true");
  if (stored.contentType) {
    reply.header("content-type", stored.contentType);
  }
  for (const [key, value] of Object.entries(stored.headers)) {
    if (key.toLowerCase() === "content-type") continue;
    reply.header(key, value);
  }
  reply.code(stored.statusCode);
  const contentType = stored.contentType ?? "";
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(stored.body);
      return reply.send(parsed);
    } catch {
      return reply.send(stored.body);
    }
  }
  return reply.send(stored.body);
}

export const idempotencyPlugin = fp(async (app) => {
  app.addHook("onRequest", async (req, reply) => {
    if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") {
      return;
    }
    const key = req.headers["idempotency-key"];
    if (typeof key !== "string" || !key.trim()) {
      return;
    }
    const cacheKey = `${IDEMPOTENCY_PREFIX}:${key}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) {
      const stored = JSON.parse(cached) as StoredResponse;
      return replayResponse(reply, stored);
    }
    const lockKey = `${LOCK_PREFIX}:${key}`;
    const acquired = await app.redis.setnx(lockKey, "1", LOCK_TTL_SECONDS);
    if (!acquired) {
      reply.code(409);
      return reply.send({ error: "idempotency_conflict" });
    }
    req.idempotencyKey = key;
  });

  app.addHook("onSend", async (req, reply, payload) => {
    const key = req.idempotencyKey;
    if (!key) {
      return payload;
    }
    try {
      const cacheKey = `${IDEMPOTENCY_PREFIX}:${key}`;
      const lockKey = `${LOCK_PREFIX}:${key}`;
      const headers: Record<string, string> = {};
      for (const name of Object.keys(reply.getHeaders())) {
        const value = reply.getHeader(name);
        if (typeof value === "string") {
          headers[name] = value;
        }
      }
      const contentType = reply.getHeader("content-type");
      let bodyString: string;
      if (payload instanceof Buffer) {
        bodyString = payload.toString("utf8");
      } else if (typeof payload === "string") {
        bodyString = payload;
      } else {
        bodyString = JSON.stringify(payload);
      }
      const stored: StoredResponse = {
        statusCode: reply.statusCode,
        headers,
        contentType: typeof contentType === "string" ? contentType : undefined,
        body: bodyString,
      };
      await app.redis.set(cacheKey, JSON.stringify(stored), CACHE_TTL_SECONDS);
      await app.redis.del(lockKey);
    } catch (err) {
      req.log.error({ err }, "failed to persist idempotency cache");
    }
    return payload;
  });
});
