import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import type { FastifyInstance, FastifyServerOptions } from "fastify";
import { z } from "zod";
import securityPlugin from "./plugins/security";
import authPlugin from "./plugins/auth";
import orgScopePlugin from "./plugins/org-scope";

type PrismaClientLike = {
  user: {
    findMany: (args: {
      select: { email: true; orgId: true; createdAt: true };
      where: { orgId: string };
      orderBy: { createdAt: "desc" };
    }) => Promise<Array<{ email: string; orgId: string; createdAt: Date }>>;
  };
  bankLine: {
    findMany: (args: {
      where: { orgId: string };
      orderBy: { date: "desc" };
      take: number;
    }) => Promise<
      Array<{
        id: string;
        orgId: string;
        date: Date;
        amount: unknown;
        payee: string;
        desc: string;
      }>
    >;
    create: (args: {
      data: {
        orgId: string;
        date: Date;
        amount: unknown;
        payee: string;
        desc: string;
      };
    }) => Promise<unknown>;
  };
};

interface BuildAppOptions {
  logger?: FastifyServerOptions["logger"];
  prismaClient?: PrismaClientLike;
}

const bankLineBodySchema = z.object({
  date: z.string(),
  amount: z.union([z.number(), z.string()]),
  payee: z.string(),
  desc: z.string(),
  orgId: z.string().optional(),
});

export const buildApp = async (
  options: BuildAppOptions = {},
): Promise<FastifyInstance> => {
  const { logger = true } = options;
  const prismaClient: PrismaClientLike =
    options.prismaClient ??
    ((await import("../../../shared/src/db")).prisma as PrismaClientLike);

  const app = Fastify({ logger, bodyLimit: 512 * 1024 });

  await securityPlugin(app);
  await authPlugin(app);
  await orgScopePlugin(app);

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async (request) => {
    const users = await prismaClient.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      where: { orgId: request.orgId },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (request) => {
    const query = request.query as Record<string, unknown>;
    const requestedTake = Number(query.take ?? 20);
    const parsedTake = Number.isFinite(requestedTake) ? requestedTake : 20;
    const take = Math.min(Math.max(parsedTake, 1), 200);

    const lines = await prismaClient.bankLine.findMany({
      where: { orgId: request.orgId },
      orderBy: { date: "desc" },
      take,
    });
    return { lines };
  });

  app.post("/bank-lines", async (request, reply) => {
    try {
      const body = bankLineBodySchema.parse(request.body ?? {});
      const created = await prismaClient.bankLine.create({
        data: {
          orgId: request.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
      });
      return reply.code(201).send(created);
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: "bad_request" });
    }
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
};

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await buildApp();
  app
    .listen({ port, host })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}
