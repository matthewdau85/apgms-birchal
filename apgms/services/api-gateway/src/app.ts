import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";

import type { SendMessageOptions, SendMessageResult } from "@apgms/sbr";
import { createSbrRoutes } from "./routes/sbr";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export interface PrismaLike {
  user: { findMany(args: any): Promise<any> };
  bankLine: { findMany(args: any): Promise<any>; create(args: any): Promise<any> };
  sbrMessage: { create(args: any): Promise<any>; findUnique(args: any): Promise<any> };
}

async function loadDefaultPrisma(): Promise<PrismaLike> {
  const mod = await import("@apgms/shared");
  return (mod.prisma as unknown) as PrismaLike;
}

export interface ApiGatewayDependencies {
  prisma?: PrismaLike;
  sendMessage?: (payloadXml: string, options?: SendMessageOptions) => Promise<SendMessageResult>;
}

export async function buildApp(deps: ApiGatewayDependencies = {}) {
  const prismaClient = deps.prisma ?? (await loadDefaultPrisma());

  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prismaClient.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prismaClient.bankLine.findMany({
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
      const created = await prismaClient.bankLine.create({
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

  await app.register(
    createSbrRoutes({
      prisma: prismaClient,
      sendMessage: deps.sendMessage,
    }),
    { prefix: "/sbr" },
  );

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}
