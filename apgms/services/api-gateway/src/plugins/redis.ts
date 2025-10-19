import type { FastifyPluginAsync } from "fastify";

type StoredValue = unknown;

type InMemoryRedis = {
  get<T = StoredValue>(key: string): Promise<T | null>;
  set<T = StoredValue>(key: string, value: T): Promise<void>;
  setex<T = StoredValue>(key: string, _ttl: number, value: T): Promise<void>;
};

const createStore = (): InMemoryRedis => {
  const store = new Map<string, StoredValue>();
  return {
    async get<T>(key: string) {
      if (!store.has(key)) {
        return null;
      }
      return store.get(key) as T;
    },
    async set<T>(key: string, value: T) {
      store.set(key, value);
    },
    async setex<T>(key: string, _ttl: number, value: T) {
      store.set(key, value);
    },
  };
};

const plugin: FastifyPluginAsync = async (fastify) => {
  const redis = createStore();
  fastify.decorate("redis", redis);
};

(plugin as any)[Symbol.for("skip-override")] = true;
(plugin as any)[Symbol.for("fastify.display-name")] = "redisPlugin";
(plugin as any)[Symbol.for("plugin-meta")] = {
  name: "redisPlugin",
};

export const redisPlugin = plugin;

declare module "fastify" {
  interface FastifyInstance {
    redis: InMemoryRedis;
  }
}
