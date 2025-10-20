import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";

export async function build(app?: FastifyInstance) {
  const server = app ?? Fastify({ logger: true });

  await server.register(cors, { origin: true });

  // sanity log: confirm env is loaded
  server.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  server.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  if (process.env.API_GATEWAY_DISABLE_DB === "true") {
    server.log.warn("database-backed routes are disabled");
  } else {
    const { prisma } = await import("../../../shared/src/db");

    // List users (email + org)
    server.get("/users", async () => {
      const users = await prisma.user.findMany({
        select: { email: true, orgId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return { users };
    });

    // List bank lines (latest first)
    server.get("/bank-lines", async (req) => {
      const take = Number((req.query as any).take ?? 20);
      const lines = await prisma.bankLine.findMany({
        orderBy: { date: "desc" },
        take: Math.min(Math.max(take, 1), 200),
      });
      return { lines };
    });

    // Create a bank line
    server.post("/bank-lines", async (req, rep) => {
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
  }

  return server;
}

export async function start() {
  const app = await build();

  await app.ready();
  // Print routes so we can SEE POST /bank-lines is registered
  app.log.info(app.printRoutes());

  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const entrypoint = fileURLToPath(import.meta.url);

if (process.argv[1] === entrypoint) {
  start();
}

