import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";
import idempotencyPlugin from "./plugins/idempotency.js";
import webhookPlugin from "./plugins/webhook.js";
import webhookRoutes from "./routes/webhooks.js";
import type { RedisClient } from "./infra/redis.js";

export interface CreateAppOptions {
  redis: RedisClient;
  webhookSecret: string;
  logger?: boolean;
}

export const createApp = async ({ redis, webhookSecret, logger = true }: CreateAppOptions) => {
  const app = Fastify({ logger });

  await app.register(cors, { origin: true });

  await idempotencyPlugin(app, { redis });
  await webhookPlugin(app, { redis, secret: webhookSecret });

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  // List users (email + org)
  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  // List bank lines (latest first)
  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
  });

  // Create a bank line
  app.post(
    "/bank-lines",
    { config: { idempotency: true } },
    async (req, rep) => {
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
    },
  );

  await app.register(webhookRoutes);

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
};
