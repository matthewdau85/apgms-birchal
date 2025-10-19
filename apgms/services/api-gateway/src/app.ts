import Fastify, { type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import { getPrismaClient } from "@apgms/shared/src/db";
import openApiPlugin from "./plugins/openapi";
import reportsRoutes from "./routes/v1/reports";

export async function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify({ logger: true, ...options });

  await app.register(cors, { origin: true });
  await openApiPlugin(app);

  app.log.info(
    { DATABASE_URL: process.env.DATABASE_URL },
    "loaded env",
  );

  const prisma = await getPrismaClient();

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
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
      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
      });
      return rep.code(201).send(created);
    } catch (e) {
      req.log.error(e);
      return rep.code(400).send({ error: "bad_request" });
    }
  });

  await app.register(reportsRoutes);

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

export default async function createApp(options?: FastifyServerOptions) {
  return buildApp(options);
}
