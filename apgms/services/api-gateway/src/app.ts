import "./env";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health";

type PrismaClientLike = {
  $queryRaw: (...args: any[]) => Promise<unknown>;
  user: { findMany: (...args: any[]) => Promise<unknown[]> };
  bankLine: {
    findMany: (...args: any[]) => Promise<unknown[]>;
    create: (...args: any[]) => Promise<unknown>;
  };
};

interface BuildDependencies {
  prisma?: PrismaClientLike;
}

let sharedPrismaPromise: Promise<PrismaClientLike> | null = null;

async function loadSharedPrisma(): Promise<PrismaClientLike> {
  if (!sharedPrismaPromise) {
    sharedPrismaPromise = import("../../../shared/src/db").then(
      (mod) => mod.prisma as PrismaClientLike,
    );
  }
  return sharedPrismaPromise;
}

export async function buildApp(deps: BuildDependencies = {}) {
  const prisma = deps.prisma ?? (await loadSharedPrisma());
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(healthRoutes, { prisma });

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
