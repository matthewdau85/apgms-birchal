import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import authPlugin from "./plugins/auth";
import orgScopePlugin from "./plugins/org-scope";

type PrismaClientLike = {
  user: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown>;
  };
  bankLine: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown>;
    create: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

type AuthDecorators = {
  verifyBearer: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  ensureOrgScope: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireRole: (role: string | string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

type BuildAppOptions = {
  logger?: boolean;
  prisma?: PrismaClientLike;
};

const DEFAULT_TAKE = 20;
const MAX_TAKE = 200;

async function resolvePrisma(provided?: PrismaClientLike): Promise<PrismaClientLike> {
  if (provided) {
    return provided;
  }

  const module = await import("../../../shared/src/db");
  return module.prisma as PrismaClientLike;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const { logger = true, prisma: providedPrisma } = options;
  const prisma = await resolvePrisma(providedPrisma);
  const app = Fastify({ logger });

  await app.register(cors, { origin: true });
  await authPlugin(app, {});
  await orgScopePlugin(app, {});

  const decoratedApp = app as typeof app & AuthDecorators;

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  const verifyBearer = decoratedApp.verifyBearer;
  const ensureOrgScope = decoratedApp.ensureOrgScope;
  const requireRole = decoratedApp.requireRole;

  app.get(
    "/users",
    {
      preHandler: [verifyBearer, ensureOrgScope, requireRole("admin")],
    },
    async () => {
      const users = await prisma.user.findMany({
        select: { email: true, orgId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return { users };
    }
  );

  app.get(
    "/bank-lines",
    {
      preHandler: [verifyBearer, ensureOrgScope, requireRole(["user", "admin"])],
    },
    async (request) => {
      const takeRaw = Number((request.query as Record<string, unknown>).take ?? DEFAULT_TAKE);
      const take = Math.min(Math.max(Number.isFinite(takeRaw) ? takeRaw : DEFAULT_TAKE, 1), MAX_TAKE);
      const lines = await prisma.bankLine.findMany({
        where: { orgId: request.orgId },
        orderBy: { date: "desc" },
        take,
      });
      return { lines };
    }
  );

  app.post(
    "/bank-lines",
    {
      preHandler: [verifyBearer, ensureOrgScope, requireRole(["finance", "admin"])],
    },
    async (request, reply) => {
      try {
        const body = request.body as {
          orgId: string;
          date: string;
          amount: number | string;
          payee: string;
          desc: string;
        };

        if (!body || body.orgId !== request.orgId) {
          return reply.code(403).send({ error: "forbidden" });
        }

        const created = await prisma.bankLine.create({
          data: {
            orgId: body.orgId,
            date: new Date(body.date),
            amount: body.amount as any,
            payee: body.payee,
            desc: body.desc,
          },
        });
        return reply.code(201).send(created);
      } catch (err) {
        request.log.error(err);
        return reply.code(400).send({ error: "bad_request" });
      }
    }
  );

  app.post(
    "/allocations/preview",
    {
      preHandler: [verifyBearer, ensureOrgScope, requireRole(["analyst", "admin"])],
    },
    async (request) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      return {
        orgId: request.orgId,
        preview: true,
        amount: body.amount ?? null,
      };
    }
  );

  app.post(
    "/allocations/apply",
    {
      preHandler: [verifyBearer, ensureOrgScope, requireRole("admin")],
    },
    async () => ({ applied: true })
  );

  app.get(
    "/audit/rpt/:id",
    {
      preHandler: [verifyBearer, ensureOrgScope, requireRole(["auditor", "admin"])],
    },
    async (request) => ({ id: (request.params as { id: string }).id, orgId: request.orgId })
  );

  app.get(
    "/dashboard",
    {
      preHandler: [verifyBearer, ensureOrgScope, requireRole(["user", "admin"])],
    },
    async (request) => ({ orgId: request.orgId, stats: {} })
  );

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isExecutedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (isExecutedDirectly) {
  start();
}
