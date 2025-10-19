import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

type RedisClient = {
  ping: () => Promise<unknown> | unknown;
};

declare module "fastify" {
  interface FastifyInstance {
    prisma?: PrismaClient;
    redis?: RedisClient;
  }
}

async function checkRedis(app: FastifyInstance): Promise<string | null> {
  if (!app.redis) {
    return null;
  }

  try {
    await app.redis.ping();
    return null;
  } catch (error) {
    app.log.error({ err: error }, "Redis readiness check failed");
    return "redis";
  }
}

async function checkDatabase(app: FastifyInstance): Promise<string | null> {
  const prisma = app.prisma;
  if (!prisma) {
    return null;
  }

  try {
    if (typeof prisma.$queryRawUnsafe === "function") {
      await prisma.$queryRawUnsafe("SELECT 1");
    } else {
      await prisma.$queryRaw`SELECT 1`;
    }
    return null;
  } catch (error) {
    app.log.error({ err: error }, "Database readiness check failed");
    return "database";
  }
}

const healthRoutes = fp(async (app: FastifyInstance) => {
  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/ready", async (request, reply) => {
    const failures = (
      await Promise.all([checkRedis(app), checkDatabase(app)])
    ).filter((value): value is string => value !== null);

    if (failures.length > 0) {
      request.log.error({ failures }, "readiness check failed");
      return reply.code(503).send({ ok: false, failures });
    }

    return { ok: true };
  });
});

export default healthRoutes;
