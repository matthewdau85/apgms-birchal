import Fastify from "fastify";
import cors from "@fastify/cors";
import type Redis from "ioredis";
import redisPlugin from "./plugins/redis";
import idempotencyPlugin from "./plugins/idempotency";
import webhooksPlugin from "./routes/webhooks";

export interface BuildAppOptions {
  redisClient?: Redis;
  webhookSecret?: string;
  logger?: boolean;
  prismaClient?: PrismaClientLike;
}

type PrismaClientLike = {
  user: {
    findMany: (args: any) => Promise<any>;
  };
  bankLine: {
    findMany: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
  };
};

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });

  const prisma =
    options.prismaClient ?? (await import("@apgms/shared/src/db")).prisma;

  await app.register(cors, { origin: true });
  await redisPlugin(app, { client: options.redisClient });
  await idempotencyPlugin(app);
  await webhooksPlugin(app, { secret: options.webhookSecret });

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

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

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
