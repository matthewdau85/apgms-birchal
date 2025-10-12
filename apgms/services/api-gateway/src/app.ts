import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import type { PrismaClient } from "@prisma/client";

export interface CreateAppOptions {
  prismaClient?: Pick<PrismaClient, "bankLine" | "user">;
  fastifyOptions?: FastifyServerOptions;
  enableCors?: boolean;
}

let defaultPrisma: Pick<PrismaClient, "bankLine" | "user"> | null = null;

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const { prismaClient, fastifyOptions, enableCors = true } = options;

  if (!defaultPrisma && !prismaClient) {
    const module = await import("../../../shared/src/db");
    defaultPrisma = module.prisma;
  }

  const prisma = prismaClient ?? defaultPrisma!;

  const app = Fastify(fastifyOptions ?? { logger: true });

  if (enableCors) {
    await app.register(cors, { origin: true });
  }

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as Record<string, string | undefined>).take ?? 20);
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

  return app;
}
