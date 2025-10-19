import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type Redis from "ioredis";

type CachedResponse = {
  statusCode: number;
  payload: string;
  payloadEncoding: "utf8" | "base64";
  headers: Record<string, string>;
};

type PendingEntry = { pending: true };

type CacheEntry = CachedResponse | PendingEntry;

const IDEMPOTENCY_PREFIX = "idempotency:";
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24h
const IDEMPOTENCY_KEY_HEADER = "idempotency-key";
const IDEMPOTENCY_REDIS_KEY = Symbol("idempotencyRedisKey");

declare module "fastify" {
  interface FastifyRequest {
    [IDEMPOTENCY_REDIS_KEY]?: string;
  }
}

function isPending(entry: CacheEntry): entry is PendingEntry {
  return (entry as PendingEntry).pending === true && !(entry as CachedResponse).statusCode;
}

function serializePayload(payload: unknown): {
  data: string;
  encoding: CachedResponse["payloadEncoding"];
} {
  if (typeof payload === "string") {
    return { data: payload, encoding: "utf8" };
  }
  if (Buffer.isBuffer(payload)) {
    return { data: payload.toString("base64"), encoding: "base64" };
  }
  if (payload === null || payload === undefined) {
    return { data: "", encoding: "utf8" };
  }
  return { data: JSON.stringify(payload), encoding: "utf8" };
}

function deserializePayload(entry: CachedResponse): string | Buffer {
  if (entry.payloadEncoding === "base64") {
    return Buffer.from(entry.payload, "base64");
  }
  return entry.payload;
}

function makeRedisKey(idempotencyKey: string): string {
  return `${IDEMPOTENCY_PREFIX}${idempotencyKey}`;
}

async function cachePending(redis: Redis, key: string): Promise<boolean> {
  const result = await redis.set(key, JSON.stringify({ pending: true }), "NX", "EX", IDEMPOTENCY_TTL_SECONDS);
  return result === "OK";
}

function isIdempotencyDisabled(request: FastifyRequest): boolean {
  const config: any = request.routeOptions?.config ?? {};
  const setting = config.idempotency;
  if (setting === false) {
    return true;
  }
  if (setting && typeof setting === "object" && setting.enabled === false) {
    return true;
  }
  return false;
}

const idempotencyPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST") {
      return;
    }

    if (isIdempotencyDisabled(request)) {
      return;
    }

    const headerValue = request.headers[IDEMPOTENCY_KEY_HEADER];
    const idempotencyKey =
      typeof headerValue === "string"
        ? headerValue.trim()
        : Array.isArray(headerValue)
          ? headerValue[0]?.trim() ?? ""
          : "";

    if (!idempotencyKey) {
      reply.code(400);
      return reply.send({ error: "missing_idempotency_key" });
    }

    const redisKey = makeRedisKey(idempotencyKey);
    const rawEntry = await fastify.redis.get(redisKey);

    if (rawEntry) {
      const cached: CacheEntry = JSON.parse(rawEntry);
      if (isPending(cached)) {
        reply.code(409);
        return reply.send({ error: "idempotency_in_progress" });
      }

      reply.code(cached.statusCode);
      for (const [header, value] of Object.entries(cached.headers)) {
        reply.header(header, value);
      }
      return reply.send(deserializePayload(cached));
    }

    const reserved = await cachePending(fastify.redis, redisKey);
    if (!reserved) {
      reply.code(409);
      return reply.send({ error: "idempotency_in_progress" });
    }

    (request as any)[IDEMPOTENCY_REDIS_KEY] = redisKey;
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    if (request.method !== "POST") {
      return payload;
    }

    if (isIdempotencyDisabled(request)) {
      return payload;
    }

    const redisKey = (request as any)[IDEMPOTENCY_REDIS_KEY];
    if (!redisKey) {
      return payload;
    }

    try {
      if (reply.statusCode === 200 || reply.statusCode === 201) {
        const { data, encoding } = serializePayload(payload);
        const headers: Record<string, string> = {};
        const currentHeaders = reply.getHeaders();
        for (const [header, value] of Object.entries(currentHeaders)) {
          if (typeof value === "string") {
            headers[header] = value;
          } else if (typeof value === "number") {
            headers[header] = value.toString();
          } else if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
            headers[header] = value.join(", ");
          }
        }
        const record: CachedResponse = {
          statusCode: reply.statusCode,
          payload: data,
          payloadEncoding: encoding,
          headers,
        };
        await fastify.redis.set(
          redisKey,
          JSON.stringify(record),
          "XX",
          "EX",
          IDEMPOTENCY_TTL_SECONDS,
        );
      } else {
        await fastify.redis.del(redisKey);
      }
    } catch (error) {
      request.log.error({ err: error }, "idempotency cache failure");
    }

    return payload;
  });
};

export default idempotencyPlugin;
