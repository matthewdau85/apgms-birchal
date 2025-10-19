import type { FastifyInstance } from "fastify";

type Queryable = {
  $queryRaw<T = unknown>(query: TemplateStringsArray | string): Promise<T>;
};

export function registerHealthRoutes(app: FastifyInstance, prisma: Queryable): void {
  app.get("/livez", async (_, reply) => {
    reply.code(200).send({ ok: true });
  });

  app.get("/readyz", async (_, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      reply.code(200).send({ ready: true });
    } catch (err) {
      app.log.error({ err }, "database readiness check failed");
      reply.code(503).send({ ready: false, reason: "db" });
    }
  });
}
