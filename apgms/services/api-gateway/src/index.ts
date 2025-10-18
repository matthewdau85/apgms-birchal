import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const isMainModule =
  typeof process.argv[1] === "string" &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

import Fastify from "fastify";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../../shared/src/db";
import { healthRoutes } from "./routes/health";

export async function createApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(healthRoutes);

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

  // Print routes so we can SEE POST /bank-lines is registered
  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

export function setupSignalHandlers(
  app: FastifyInstance,
  prismaClient: Pick<PrismaClient, "$disconnect"> = prisma,
) {
  let shuttingDown = false;

  const handleShutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      app.log.info({ signal }, "shutdown already in progress");
      return;
    }
    shuttingDown = true;

    app.log.info({ signal }, "received shutdown signal");

    try {
      await app.close();
    } catch (error) {
      app.log.error({ err: error }, "error closing fastify app");
    }

    try {
      await prismaClient.$disconnect();
    } catch (error) {
      app.log.error({ err: error }, "error disconnecting prisma");
    }
  };

  const listener = (signal: NodeJS.Signals) => {
    handleShutdown(signal).catch((error) => {
      app.log.error({ err: error }, "unexpected shutdown error");
    });
  };

  process.on("SIGTERM", listener);
  process.on("SIGINT", listener);

  return () => {
    process.off("SIGTERM", listener);
    process.off("SIGINT", listener);
  };
}

async function main() {
  const app = await createApp();
  const removeSignalHandlers = setupSignalHandlers(app);

  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    removeSignalHandlers();
    await prisma.$disconnect();
    process.exit(1);
  }
}

if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
