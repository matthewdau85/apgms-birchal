import type { FastifyPluginAsync } from "fastify";
import Redis from "ioredis";
import { prisma } from "@apgms/shared/db";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const redis = new Redis(redisUrl, { lazyConnect: true });

const readyRoutes: FastifyPluginAsync = async (fastify) => {
  const connectRedis = async () => {
    if (
      redis.status === "wait" ||
      redis.status === "connecting" ||
      redis.status === "reconnecting" ||
      redis.status === "end"
    ) {
      try {
        await redis.connect();
      } catch (error) {
        fastify.log.warn({ err: error }, "Failed to connect to Redis");
      }
    }
  };

  fastify.addHook("onReady", async () => {
    await connectRedis();
  });

  if (redis.listeners("error").length === 0) {
    redis.on("error", (error) => {
      fastify.log.error({ err: error }, "Redis connection error");
    });
  }

  fastify.addHook("onClose", async () => {
    if (redis.status !== "end") {
      await redis.quit();
    }
  });

  fastify.get("/ready", async (request, reply) => {
    try {
      await connectRedis();
      await prisma.$queryRaw`SELECT 1`;
      if (redis.status !== "ready") {
        throw new Error("redis_not_ready");
      }
      return { status: "ready" };
    } catch (error) {
      request.log.warn({ err: error }, "Readiness check failed");
      reply.code(503);
      return { status: "starting" };
    }
  });
};

export default readyRoutes;
export { redis };
