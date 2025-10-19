import type { FastifyPluginAsync } from "fastify";

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode?: "EX" | "PX" | string,
    duration?: number,
  ): Promise<unknown>;
  quit(): Promise<void>;
};

const createFallbackRedis = (): RedisLike => {
  const store = new Map<string, string>();

  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, mode?: string, duration?: number) {
      store.set(key, value);

      if (mode === "EX" && typeof duration === "number") {
        const timeout = setTimeout(() => {
          store.delete(key);
        }, duration * 1000);

        if (typeof timeout.unref === "function") {
          timeout.unref();
        }
      }

      return "OK";
    },
    async quit() {
      store.clear();
    },
  };
};

export const redisPlugin: FastifyPluginAsync = async (app) => {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  let client: RedisLike | null = null;

  try {
    const redisModule = await import("ioredis");
    const RedisCtor = (redisModule as any).default ?? redisModule;
    client = new RedisCtor(url) as RedisLike;
  } catch (error) {
    app.log.warn(
      { err: error },
      "ioredis not available; falling back to in-memory cache",
    );
    client = createFallbackRedis();
  }

  app.decorate("redis", client);

  app.addHook("onClose", async () => {
    await client?.quit();
  });
};

(redisPlugin as any)[Symbol.for("skip-override")] = true;
(redisPlugin as any)[Symbol.for("fastify.displayName")] = "redisPlugin";

declare module "fastify" {
  interface FastifyInstance {
    redis: RedisLike;
  }
}
