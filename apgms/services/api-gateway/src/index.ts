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
import { withIdempotency } from "./idempotency";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

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

    const idempotencyKeyHeader = req.headers["idempotency-key"];
    const idempotencyKey = (Array.isArray(idempotencyKeyHeader)
      ? idempotencyKeyHeader[0]
      : idempotencyKeyHeader)?.trim();

    const result = await withIdempotency(body.orgId, idempotencyKey, async () => {
      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
      });

      return { statusCode: 201, body: created };
    });

    return rep.code(result.statusCode).send(result.body);
  } catch (e) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request" });
  }
});

app.post("/bank-lines/import", async (req, rep) => {
  try {
    const body = req.body as {
      orgId: string;
      lines: Array<{
        date: string;
        amount: number | string;
        payee: string;
        desc: string;
      }>;
    };

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return rep.code(400).send({ error: "bad_request" });
    }

    const idempotencyKeyHeader = req.headers["idempotency-key"];
    const idempotencyKey = (Array.isArray(idempotencyKeyHeader)
      ? idempotencyKeyHeader[0]
      : idempotencyKeyHeader)?.trim();

    const result = await withIdempotency(body.orgId, idempotencyKey, async () => {
      const created = await prisma.bankLine.createMany({
        data: body.lines.map((line) => ({
          orgId: body.orgId,
          date: new Date(line.date),
          amount: line.amount as any,
          payee: line.payee,
          desc: line.desc,
        })),
        skipDuplicates: true,
      });

      return { statusCode: 201, body: { count: created.count } };
    });

    return rep.code(result.statusCode).send(result.body);
  } catch (e) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request" });
  }
});

// Print routes so we can SEE POST /bank-lines is registered
app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

