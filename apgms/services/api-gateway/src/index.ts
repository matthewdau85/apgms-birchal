import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";
import { authMiddleware } from "./middleware/auth";
import { orgScopeMiddleware } from "./middleware/org-scope";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  const shouldSkip = (reqPath?: string) => reqPath?.startsWith("/healthz") ?? false;

  app.addHook("preHandler", async (req, reply) => {
    if (shouldSkip(req.raw.url) || reply.sent) {
      return;
    }
    await authMiddleware(req, reply);
    if (!reply.sent) {
      await orgScopeMiddleware(req, reply);
    }
  });

  app.get("/healthz", async () => ({ ok: true, service: "api-gateway" }));

  // List users (email + org)
  app.get("/users", async (req) => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      where: { orgId: req.orgId },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  // List bank lines (latest first)
  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      where: { orgId: req.orgId },
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
  });

  // Create a bank line
  app.post("/bank-lines", async (req, rep) => {
    try {
      const body = req.body as {
        orgId?: string;
        date: string;
        amount: number | string;
        payee: string;
        desc: string;
      };
      const created = await prisma.bankLine.create({
        data: {
          orgId: req.orgId!,
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

  // Print routes so we can SEE POST /bank-lines is registered
  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  app.listen({ port, host }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

