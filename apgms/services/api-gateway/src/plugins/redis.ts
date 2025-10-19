import type { FastifyPluginAsync } from "fastify";
import Redis from "ioredis";

type RedisPluginOptions = {
  client?: Redis;
  url?: string;
};

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync<RedisPluginOptions> = async (fastify, opts) => {
  const client = opts.client ?? new Redis(opts.url ?? process.env.REDIS_URL);

  if (client.status !== "ready") {
    await client.connect();
  }

  fastify.decorate("redis", client);

  fastify.addHook("onClose", async () => {
    await client.quit();
  });
};

export default redisPlugin;
