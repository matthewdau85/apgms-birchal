import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../../../shared/src/db";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/healthz", async () => ({
    ok: true,
    service: "api-gateway",
  }));

  app.get("/readyz", async (_, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch (error) {
      app.log.error({ err: error }, "database readiness check failed");
      return reply.code(503).send({ ready: false, reason: "db_unreachable" });
    }
  });
};

export default healthRoutes;
