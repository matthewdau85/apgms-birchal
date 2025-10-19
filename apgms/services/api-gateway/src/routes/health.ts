import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../../../shared/src/db";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/healthz", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/readyz", async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch (error) {
      request.log.error({ err: error }, "readiness check failed");
      return reply.status(503).send({ ready: false, reason: "db_unreachable" });
    }
  });
};

export default healthRoutes;
