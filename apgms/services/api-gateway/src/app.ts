import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@apgms/shared/db";
import allocationsRoutes from "./routes/allocations.js";
import auditRoutes from "./routes/audit.js";

export interface BuildAppOptions {
  logger?: boolean | object;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });

  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as Record<string, unknown>).take ?? 20);
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
    } catch (error) {
      req.log.error(error);
      return rep.code(400).send({ error: "bad_request" });
    }
  });

  await app.register(allocationsRoutes);
  await app.register(auditRoutes);

  return app;
}
