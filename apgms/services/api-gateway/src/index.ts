import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import authPlugin from "./middleware/auth";
import { orgScope, requireRole } from "./routes/_guard";

type PrismaLike = {
  user: {
    findMany: (args: unknown) => Promise<any[]>;
  };
  bankLine: {
    findMany: (args: unknown) => Promise<any[]>;
    create: (args: { data: any }) => Promise<any>;
  };
};

interface BuildOptions {
  prismaClient?: PrismaLike;
}

let cachedPrisma: PrismaLike | null = null;

const loadPrisma = async (): Promise<PrismaLike> => {
  if (!cachedPrisma) {
    const module = await import("../../../shared/src/db");
    cachedPrisma = module.prisma as PrismaLike;
  }
  return cachedPrisma;
};

export const buildApp = async ({ prismaClient }: BuildOptions = {}): Promise<FastifyInstance> => {
  const db = prismaClient ?? (await loadPrisma());

  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await authPlugin(app);

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/healthz", async () => ({ ok: true, service: "api-gateway" }));
  app.get("/readyz", async () => ({ ready: true }));

  app.get(
    "/users",
    { preHandler: [requireRole("admin")] },
    async (req) => {
      if (!req.context) {
        throw new Error("auth context missing");
      }
      const { orgId } = req.context;
      const users = await db.user.findMany({
        where: { orgId },
        select: { email: true, orgId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return { users };
    }
  );

  app.get(
    "/bank-lines",
    {
      preHandler: [
        orgScope((req) => {
          const query = req.query as { orgId?: string };
          if (query?.orgId) {
            return query.orgId;
          }
          return req.context?.orgId ?? null;
        }),
      ],
    },
    async (req) => {
      if (!req.context) {
        throw new Error("auth context missing");
      }
      const take = Number((req.query as any).take ?? 20);
      const orgId =
        (req.query as { orgId?: string }).orgId ?? req.context.orgId;
      const lines = await db.bankLine.findMany({
        where: { orgId },
        orderBy: { date: "desc" },
        take: Math.min(Math.max(take, 1), 200),
      });
      return { lines };
    }
  );

  app.post(
    "/bank-lines",
    {
      preHandler: [
        orgScope((req) => {
          const body = req.body as { orgId?: string };
          return body?.orgId ?? null;
        }),
      ],
    },
    async (req, rep) => {
      try {
        const body = req.body as {
          orgId: string;
          date: string;
          amount: number | string;
          payee: string;
          desc: string;
        };
        const created = await db.bankLine.create({
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
    }
  );

  app.get(
    "/admin/reports",
    { preHandler: [requireRole("admin")] },
    async (req) => {
      if (!req.context) {
        throw new Error("auth context missing");
      }
      return {
        orgId: req.context.orgId,
        reports: [],
      };
    }
  );

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
};

const start = async () => {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";
  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const isEntryPoint = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
};

if (isEntryPoint()) {
  start();
}
