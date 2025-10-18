import Redis from "ioredis";

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: "PX" | "EX", ttl?: number): Promise<"OK" | null>;
}

class InMemoryRedis implements RedisLike {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt !== 0 && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, mode?: "PX" | "EX", ttl?: number): Promise<"OK"> {
    let expiresAt = 0;
    if (mode && ttl) {
      const duration = mode === "PX" ? ttl : ttl * 1000;
      expiresAt = Date.now() + duration;
    }
    this.store.set(key, { value, expiresAt });
    return "OK";
  }
}

let client: RedisLike | null = null;

export const getRedis = (): RedisLike => {
  if (client) {
    return client;
  }

  const url = process.env.API_GATEWAY_REDIS_URL ?? process.env.REDIS_URL;
  if (url) {
    const redis = new Redis(url, { lazyConnect: true });
    client = {
      get: async (key: string) => redis.get(key),
      set: async (key: string, value: string, mode?: "PX" | "EX", ttl?: number) => {
        if (mode && ttl) {
          return redis.set(key, value, mode, ttl);
        }
        return redis.set(key, value);
      },
    } satisfies RedisLike;
  } else {
    client = new InMemoryRedis();
  }

  return client;
};
