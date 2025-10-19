import cors from "@fastify/cors";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import type { PrismaClient } from "@prisma/client";

export type DatabaseClient = {
  $queryRaw: PrismaClient["$queryRaw"];
  $disconnect: PrismaClient["$disconnect"];
  user: Pick<PrismaClient["user"], "findMany">;
  bankLine: Pick<PrismaClient["bankLine"], "findMany" | "create">;
};

export interface AppDependencies {
  prisma: DatabaseClient;
}

export function buildApp(
  options: FastifyServerOptions = {},
  deps: AppDependencies,
): FastifyInstance {
  const app = Fastify({
    logger: true,
    ...options,
  });

  void app.register(cors, { origin: true });

  app.get("/healthz", async () => ({ status: "ok", service: "api-gateway" }));

  app.get("/readyz", async (_, reply) => {
    try {
      await deps.prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch (error) {
      app.log.error({ err: error }, "database ping failed");
      return reply.status(503).send({ status: "error", reason: "database_unreachable" });
    }
  });

  app.get("/users", async () => {
    const users = await deps.prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await deps.prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
  });

  app.post("/bank-lines", async (req, rep) => {
    try {
      const body = req.body as {
        orgId: string;
        date: string;
        amount: number | string;
        payee: string;
        desc: string;
      };
      const created = await deps.prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
      });
      return rep.code(201).send(created);
    } catch (error) {
      req.log.error(error);
      return rep.code(400).send({ error: "bad_request" });
    }
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
