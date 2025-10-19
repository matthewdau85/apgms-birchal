import type { FastifyInstance, FastifyServerOptions } from "fastify";
import Fastify from "fastify";
import cors from "@fastify/cors";
import type { PrismaClient } from "@prisma/client";
import { registerAuthGuard } from "./auth/auth.guard";

export interface BuildAppOptions {
  logger?: FastifyServerOptions["logger"];
}

export interface PrismaAdapter {
  user: {
    findMany: PrismaClient["user"]["findMany"];
  };
  bankLine: {
    findMany: PrismaClient["bankLine"]["findMany"];
    findFirst: PrismaClient["bankLine"]["findFirst"];
    create: PrismaClient["bankLine"]["create"];
  };
}

export interface RouteDescriptor {
  method: string;
  url: string;
  requiresAuth: boolean;
}

export interface InstrumentedFastifyInstance extends FastifyInstance {
  routeRegistry: RouteDescriptor[];
}

export async function buildApp(
  prisma: PrismaAdapter,
  options: BuildAppOptions = {}
): Promise<InstrumentedFastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true }) as InstrumentedFastifyInstance;
  const registry: RouteDescriptor[] = [];
  app.routeRegistry = registry;

  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      registry.push({
        method,
        url: route.url,
        requiresAuth: route.config?.auth !== false,
      });
    }
  });

  await app.register(cors, { origin: true });
  await registerAuthGuard(app);

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get(
    "/health",
    {
      config: { auth: false },
    },
    async () => ({ ok: true, service: "api-gateway" })
  );

  app.get("/users", async (req) => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      where: { orgId: req.authContext?.orgId },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
      where: { orgId: req.authContext?.orgId },
    });
    return { lines };
  });

  app.post("/bank-lines", async (req, rep) => {
    try {
      if (!req.authContext) {
        return rep.code(401).send({ error: "unauthorized" });
      }
      const body = req.body as {
        date: string;
        amount: number | string;
        payee: string;
        desc: string;
      };

      const existing = await prisma.bankLine.findFirst({
        where: {
          orgId: req.authContext.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
      });

      if (existing) {
        return rep.code(200).send(existing);
      }

      const created = await prisma.bankLine.create({
        data: {
          orgId: req.authContext.orgId,
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

  return app;
}
