import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../../shared/src/db";
import healthRoutes from "./routes/health";

export const buildApp = (): FastifyInstance => {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  // List users (email + org)
  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  // List bank lines (latest first)
  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
  });

  // Create a bank line
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

  app.register(healthRoutes);

  // Print routes so we can SEE POST /bank-lines is registered
  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
};

export const app = buildApp();

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

const start = async () => {
  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== "test") {
  start();
}

let shuttingDown = false;

export const shutdown = async (): Promise<void> => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  try {
    await app.close();
  } catch (err) {
    app.log.error({ err }, "failed to close fastify instance");
  }

  try {
    await prisma.$disconnect();
  } catch (err) {
    app.log.error({ err }, "failed to disconnect prisma client");
  }
};

export const handleShutdownSignal = async (signal: NodeJS.Signals): Promise<void> => {
  try {
    app.log.info({ signal }, "received shutdown signal");
    await shutdown();
  } catch (err) {
    app.log.error({ err, signal }, "error during shutdown");
  }
};

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    handleShutdownSignal(signal).catch((err) => {
      app.log.error({ err, signal }, "error during shutdown");
    });
  });
}
