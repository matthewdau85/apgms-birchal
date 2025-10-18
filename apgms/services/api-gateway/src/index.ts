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

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

app.get("/livez", async () => ({ status: "ok" }));

app.get("/readyz", async (req, rep) => {
  if (process.env.CHAOS_DB_DOWN === "true") {
    req.log.warn("chaos toggle forcing readiness failure");
    return rep.code(503).send({ status: "fail", reason: "chaos_db_down" });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (error) {
    req.log.error({ err: error }, "readiness probe failed");
    return rep.code(503).send({ status: "fail", reason: "db_unavailable" });
  }
});

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

app.post("/allocations/apply", async (req, rep) => {
  const idempotencyKeyHeader = req.headers["idempotency-key"];
  const idempotencyKey = Array.isArray(idempotencyKeyHeader)
    ? idempotencyKeyHeader[0]
    : idempotencyKeyHeader;

  if (!idempotencyKey) {
    return rep.code(400).send({ error: "missing_idempotency_key" });
  }

  const body = req.body as {
    orgId?: string;
    allocations?: Array<{ lineId?: string; amount?: number | string }>;
  };

  if (!body?.orgId || !Array.isArray(body.allocations) || body.allocations.length === 0) {
    return rep.code(400).send({ error: "invalid_request" });
  }

  req.log.info(
    {
      orgId: body.orgId,
      idempotencyKey,
      allocations: body.allocations.map((item) => item.lineId).filter(Boolean),
    },
    "allocations apply requested",
  );

  return rep.code(202).send({ status: "accepted", idempotencyKey });
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

