import type { FastifyPluginAsync, FastifyInstance } from "fastify";

type PrismaLike = {
  $queryRaw: (...args: unknown[]) => Promise<unknown>;
  $disconnect: () => Promise<void>;
};

const healthRoutes: FastifyPluginAsync = async (app) => {
  const prisma = (app as FastifyInstance & { prisma: PrismaLike }).prisma;

  app.get("/healthz", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/readyz", async (_, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch {
      return reply.status(503).send({ ready: false, reason: "db_unreachable" });
    }
  });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};

export default healthRoutes;
