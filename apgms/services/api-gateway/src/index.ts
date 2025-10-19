import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import authPlugin from "./plugins/auth";
import orgScopePlugin from "./plugins/org-scope";

type PrismaUserClient = {
  findMany: (...args: any[]) => Promise<any>;
};

type PrismaBankLineClient = {
  findMany: (...args: any[]) => Promise<any>;
  create: (...args: any[]) => Promise<any>;
};

type PrismaScopedClient = {
  user: PrismaUserClient;
  bankLine: PrismaBankLineClient;
};

type BuildAppOptions = {
  prismaClient?: PrismaScopedClient;
};

let cachedPrisma: PrismaScopedClient | null = null;

const loadPrisma = async (): Promise<PrismaScopedClient> => {
  if (cachedPrisma) {
    return cachedPrisma;
  }
  const module = await import("../../../shared/src/db");
  cachedPrisma = module.prisma as unknown as PrismaScopedClient;
  return cachedPrisma;
};

export const buildApp = async ({ prismaClient }: BuildAppOptions = {}) => {
  const app = Fastify({ logger: true });
  const db = prismaClient ?? (await loadPrisma());

  await app.register(cors, { origin: true });
  await authPlugin(app);
  await orgScopePlugin(app);

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.route({
    method: "GET",
    url: "/users",
    preHandler: [app.authenticate, app.enforceOrgScope],
    handler: async (request) => {
      const users = await db.user.findMany({
        where: { orgId: request.user!.orgId },
        select: { email: true, orgId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return { users };
    },
  });

  app.route({
    method: "GET",
    url: "/bank-lines",
    preHandler: [app.authenticate, app.enforceOrgScope],
    handler: async (request) => {
      const take = Number((request.query as any).take ?? 20);
      const lines = await db.bankLine.findMany({
        where: { orgId: request.user!.orgId },
        orderBy: { date: "desc" },
        take: Math.min(Math.max(take, 1), 200),
      });
      return { lines };
    },
  });

  app.route({
    method: "POST",
    url: "/bank-lines",
    preHandler: [app.authenticate, app.enforceOrgScope],
    handler: async (request, reply) => {
      try {
        const body = request.body as {
          orgId?: string;
          date: string;
          amount: number | string;
          payee: string;
          desc: string;
        };
        const created = await db.bankLine.create({
          data: {
            orgId: request.user!.orgId,
            date: new Date(body.date),
            amount: body.amount as any,
            payee: body.payee,
            desc: body.desc,
          },
        });
        return reply.code(201).send(created);
      } catch (e) {
        request.log.error(e);
        return reply.code(400).send({ error: "bad_request" });
      }
    },
  });

  // Print routes so we can SEE POST /bank-lines is registered
  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
};

if (process.env.NODE_ENV !== "test") {
  const app = await buildApp();

  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  app.listen({ port, host }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
