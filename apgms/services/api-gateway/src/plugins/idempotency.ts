import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { createRedisClient, type RedisClient } from "../lib/redis";

interface CacheEntry {
  bodyHash: string;
  statusCode: number;
  resultJson: string;
}

interface IdempotencyContext {
  key: string;
  bodyHash: string;
  fromCache?: boolean;
}

export interface IdempotencyPluginOptions {
  redis?: RedisClient;
  ttlSeconds?: number;
}

declare module "fastify" {
  interface FastifyInstance {
    redis: RedisClient;
  }

  interface FastifyRequest {
    rawBody?: string | Buffer;
    idempotencyContext?: IdempotencyContext;
  }
}

type IdempotencyRequest = FastifyRequest & {
  rawBody?: string | Buffer;
  idempotencyContext?: IdempotencyContext;
};

const HASH_ALGORITHM = "sha256";
const IDEMPOTENCY_PREFIX = "idempotency:";

function resolveRequestBodyBuffer(request: IdempotencyRequest): Buffer {
  const raw = request.rawBody;
  if (Buffer.isBuffer(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    return Buffer.from(raw);
  }

  const { body } = request;
  if (body === undefined || body === null) {
    return Buffer.alloc(0);
  }
  if (typeof body === "string") {
    return Buffer.from(body);
  }
  return Buffer.from(JSON.stringify(body));
}

const idempotencyPlugin = async (fastify: FastifyInstance, opts: IdempotencyPluginOptions = {}) => {
  const ttlSeconds = opts.ttlSeconds ?? Number(process.env.IDEMPOTENCY_TTL_SEC ?? 86_400);
  const redisInstance = opts.redis ?? createRedisClient();
  const ownsRedis = !opts.redis;

  if (!fastify.hasDecorator("redis")) {
    fastify.decorate("redis", redisInstance);
  }

  fastify.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST") {
      return;
    }

    const keyHeader = request.headers["x-idempotency-key"];
    if (!keyHeader || Array.isArray(keyHeader)) {
      return;
    }

    const bodyBuffer = resolveRequestBodyBuffer(request as IdempotencyRequest);
    const bodyHash = crypto.createHash(HASH_ALGORITHM).update(bodyBuffer).digest("hex");
    const redisKey = `${IDEMPOTENCY_PREFIX}${keyHeader}`;

    try {
      const cachedRaw = await redisInstance.get(redisKey);
      if (cachedRaw) {
        const cached: CacheEntry = JSON.parse(cachedRaw);
        if (cached.bodyHash === bodyHash) {
          (request as IdempotencyRequest).idempotencyContext = {
            key: keyHeader,
            bodyHash,
            fromCache: true,
          };

          let parsedPayload: unknown = cached.resultJson;
          if (cached.resultJson) {
            try {
              parsedPayload = JSON.parse(cached.resultJson);
            } catch (err) {
              request.log.warn({ err }, "failed to parse cached idempotent payload; returning raw string");
              parsedPayload = cached.resultJson;
            }
          }

          reply.header("x-idempotent-replay", "1");
          reply.code(cached.statusCode);
          reply.send(parsedPayload);
          return reply;
        }

        reply.code(409).send({ error: "idempotency_conflict" });
        return reply;
      }
    } catch (err) {
      request.log.error({ err }, "failed to read idempotency cache");
    }

    (request as IdempotencyRequest).idempotencyContext = {
      key: keyHeader,
      bodyHash,
    };
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    const context = (request as IdempotencyRequest).idempotencyContext;
    if (!context || context.fromCache || request.method !== "POST") {
      return payload;
    }

    const redisKey = `${IDEMPOTENCY_PREFIX}${context.key}`;
    let serializedPayload: string;

    if (Buffer.isBuffer(payload)) {
      serializedPayload = payload.toString("utf8");
    } else if (typeof payload === "string") {
      serializedPayload = payload;
    } else if (payload === undefined || payload === null) {
      serializedPayload = "";
    } else {
      serializedPayload = JSON.stringify(payload);
    }

    const cacheEntry: CacheEntry = {
      bodyHash: context.bodyHash,
      statusCode: reply.statusCode,
      resultJson: serializedPayload,
    };

    try {
      await redisInstance.set(redisKey, JSON.stringify(cacheEntry), "EX", ttlSeconds);
    } catch (err) {
      request.log.error({ err }, "failed to store idempotency cache");
    }

    return payload;
  });

  fastify.addHook("onClose", async (_instance, done) => {
    if (ownsRedis) {
      try {
        await redisInstance.quit();
      } catch (err) {
        fastify.log.error({ err }, "failed to close redis connection");
      }
    }
    done();
  });
};

export default idempotencyPlugin;
