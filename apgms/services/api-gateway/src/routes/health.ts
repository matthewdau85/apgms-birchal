import type { FastifyPluginAsync } from "fastify";

export type HealthDependencies = {
  prisma: {
    $queryRaw: (...args: unknown[]) => Promise<unknown>;
  };
};

export const healthRoutes = ({ prisma }: HealthDependencies): FastifyPluginAsync => {
  return async (fastify) => {
    fastify.get("/healthz", async () => ({ status: "ok" }));

    fastify.get("/readyz", async (_request, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: "ready" };
      } catch (error) {
        fastify.log.error({ err: error }, "database ping failed");
        const reason = error instanceof Error ? error.message : "unknown_error";
        return reply.status(503).send({ status: "unhealthy", reason });
      }
    });
  };
};
