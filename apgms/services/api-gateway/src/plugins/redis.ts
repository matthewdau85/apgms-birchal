import type { FastifyPluginAsync } from "fastify";
import Redis from "../vendor/ioredis.js";

export interface RedisPluginOptions {
  url?: string;
  client?: Redis;
}

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync<RedisPluginOptions> = async (fastify, opts) => {
  const client = opts.client ?? new Redis(opts.url ?? process.env.REDIS_URL ?? "redis://127.0.0.1:6379");

  fastify.decorate("redis", client);
  fastify.log.debug({ hasClient: Boolean(opts.client) }, "redis plugin registered");

  fastify.addHook("onClose", async () => {
    if (!opts.client) {
      await client.quit();
    }
  });
};

export default redisPlugin;
