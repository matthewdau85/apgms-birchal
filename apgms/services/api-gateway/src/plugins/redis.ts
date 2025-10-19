import fp from "fastify-plugin";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

interface CacheValue {
  value: string;
  expiresAt: number | null;
}

const store = new Map<string, CacheValue>();

function cleanupExpired(key: string, entry: CacheValue | undefined) {
  if (!entry) return;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    store.delete(key);
  }
}

export const redis = {
  async get(key: string): Promise<string | null> {
    const entry = store.get(key);
    cleanupExpired(key, entry);
    return entry ? entry.value : null;
  },
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  },
  async del(key: string): Promise<void> {
    store.delete(key);
  },
  async setnx(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const existing = await this.get(key);
    if (existing !== null) {
      return false;
    }
    await this.set(key, value, ttlSeconds);
    return true;
  },
  async reset(): Promise<void> {
    store.clear();
  },
};

export type RedisClient = typeof redis;

declare module "fastify" {
  interface FastifyInstance {
    redis: RedisClient;
  }
}

const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.decorate("redis", redis);
};

export const redisPlugin = fp(plugin, {
  name: "redis-mock",
});
