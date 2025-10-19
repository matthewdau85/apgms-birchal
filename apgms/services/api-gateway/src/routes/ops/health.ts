import type { FastifyPluginAsync } from "fastify";

type RedisLike = {
  ping: () => Promise<string>;
};

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({ ok: true }));

  app.get("/ready", async (request, reply) => {
    try {
      const redis = (app as { redis?: RedisLike }).redis;
      if (!redis) {
        request.log.warn("readiness check failed: redis not registered");
        return reply.code(503).send({ ready: false });
      }

      const pong = await redis.ping();
      if (pong !== "PONG") {
        request.log.error({ pong }, "readiness check failed: redis ping");
        return reply.code(503).send({ ready: false });
      }

      return reply.send({ ready: true });
    } catch (error) {
      request.log.error({ err: error }, "readiness check failed");
      return reply.code(503).send({ ready: false });
    }
  });
};

export default healthRoutes;
