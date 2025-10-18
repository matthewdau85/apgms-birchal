import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { prisma as PrismaClientInstance } from "../../../shared/src/db";
import { requireRole } from "./authz";

export type PrismaClientLike = Pick<typeof PrismaClientInstance, "user" | "bankLine">;

export interface BuildAppOptions {
  prisma: PrismaClientLike;
}

export function buildApp({ prisma }: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

  app.get(
    "/health",
    { preHandler: requireRole("viewer") },
    async () => ({ ok: true, service: "api-gateway" }),
  );

  app.get(
    "/users",
    { preHandler: requireRole("admin") },
    async () => {
      const users = await prisma.user.findMany({
        select: { email: true, orgId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return { users };
    },
  );

  app.get(
    "/bank-lines",
    { preHandler: requireRole("viewer") },
    async (req) => {
      const take = Number((req.query as any).take ?? 20);
      const lines = await prisma.bankLine.findMany({
        orderBy: { date: "desc" },
        take: Math.min(Math.max(take, 1), 200),
      });
      return { lines };
    },
  );

  app.post(
    "/bank-lines",
    { preHandler: requireRole("analyst") },
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

        return rep.code(200).send(created);
      } catch (error) {
        req.log.error(error);
        return rep.code(400).send({ error: "bad_request" });
      }
    },
  );

  return app;
}
