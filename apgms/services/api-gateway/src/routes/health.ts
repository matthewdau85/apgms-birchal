import { FastifyInstance } from "fastify";
import { prisma } from "@apgms/shared/src/db";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/healthz", async () => ({ ok: true }));

  app.get("/readyz", async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.code(200).send({ ready: true });
    } catch (error) {
      request.log.error({ err: error }, "database readiness check failed");
      return reply.code(503).send({ ready: false, reason: "database_unreachable" });
    }
  });
}
