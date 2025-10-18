import type { FastifyBaseLogger } from "fastify";
import InMemoryRedis from "./in-memory-redis";
import type { IdempotencyStore } from "../plugins/idempotency";

export interface RedisClient extends IdempotencyStore {
  quit(): Promise<void>;
  flushall?(): Promise<void>;
}

export async function createRedisClient(
  url: string,
  logger: FastifyBaseLogger,
): Promise<RedisClient> {
  try {
    const module = await import("ioredis");
    const RedisCtor = module.default as unknown as {
      new (connection?: string): RedisClient;
    };
    return new RedisCtor(url);
  } catch (error) {
    logger.warn({ error }, "ioredis unavailable, using in-memory store for idempotency");
    return new InMemoryRedis();
  }
}
