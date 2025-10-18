import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../../../shared/src/db";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/healthz", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/readyz", async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch (error) {
      request.log.error({ err: error }, "database readiness check failed");
      reply.code(503);
      return { ready: false, reason: "db_unreachable" } as const;
    }
  });
};

export default healthRoutes;
