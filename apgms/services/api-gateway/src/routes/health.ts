import type { FastifyPluginAsync } from "fastify";

type PrismaReadinessClient = {
  $queryRaw: (...args: any[]) => Promise<unknown>;
};

export interface HealthRoutesOptions {
  prisma: PrismaReadinessClient;
}

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (
  app,
  options,
) => {
  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async (req, rep) => {
    try {
      await options.prisma.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch (error) {
      req.log.error({ err: error }, "readiness check failed");
      return rep.status(503).send({ status: "not_ready" });
    }
  });
};
