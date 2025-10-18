import type { FastifyPluginAsync } from "fastify";

export type PrismaClientLike = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

const healthRoutes: FastifyPluginAsync<{ prisma: PrismaClientLike }> = async (app, opts) => {
  const { prisma } = opts;

  app.get("/healthz", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/readyz", async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch (error) {
      request.log.error({ err: error }, "failed to ping database");
      reply.code(503);
      return { ready: false, reason: "db_unreachable" } as const;
    }
  });
};

export default healthRoutes;
