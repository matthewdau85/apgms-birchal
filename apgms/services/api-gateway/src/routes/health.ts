import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

export function registerHealthRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/healthz", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/readyz", async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch (error) {
      request.log.error({ err: error }, "readiness check failed");
      reply.status(503);
      return { ready: false, reason: "db_unreachable" } as const;
    }
  });
}
