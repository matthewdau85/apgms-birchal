import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import type { AuthUser } from "./plugins/auth.js";
import { requireRole, verifyBearer } from "./plugins/auth.js";
import { ensureOrgScope } from "./plugins/org-scope.js";

type PrismaClientLike = {
  user: {
    findMany: (...args: any[]) => Promise<any>;
  };
  bankLine: {
    findMany: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
  };
};

async function resolvePrisma(overrides?: { prisma?: PrismaClientLike }) {
  if (overrides?.prisma) {
    return overrides.prisma;
  }

  const module = await import("../../../shared/src/db");
  return module.prisma as PrismaClientLike;
}

export async function buildApp(overrides?: { prisma?: PrismaClientLike }) {
  const db = await resolvePrisma(overrides);
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  await app.register(async (protectedApp) => {
    protectedApp.decorateRequest("user", null as unknown as AuthUser);
    protectedApp.addHook("onRequest", verifyBearer());
    protectedApp.addHook("preHandler", ensureOrgScope());

    protectedApp.get(
      "/users",
      { preHandler: [requireRole("admin")] },
      async (request) => {
        const users = await db.user.findMany({
          where: { orgId: request.user.orgId },
          select: { email: true, orgId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        });
        return { users };
      },
    );

    protectedApp.get("/bank-lines", async (request) => {
      const query = request.query as { take?: number | string };
      const take = Number(query?.take ?? 20);
      const lines = await db.bankLine.findMany({
        where: { orgId: request.user.orgId },
        orderBy: { date: "desc" },
        take: Math.min(Math.max(take, 1), 200),
      });
      return { lines };
    });

    protectedApp.post("/bank-lines", async (request, reply) => {
      try {
        const body = request.body as {
          orgId: string;
          date: string;
          amount: number | string;
          payee: string;
          desc: string;
        };
        const created = await db.bankLine.create({
          data: {
            orgId: request.user.orgId,
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
  });

  // Print routes so we can SEE POST /bank-lines is registered
  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  app.listen({ port, host }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
