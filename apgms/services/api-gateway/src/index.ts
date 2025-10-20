import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

const DEFAULT_IDEMPOTENCY_TTL_SEC = 3600;
const IDEMPOTENCY_TTL_SEC = (() => {
  const raw = process.env.IDEMPOTENCY_TTL_SEC;
  if (!raw) {
    return DEFAULT_IDEMPOTENCY_TTL_SEC;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    app.log.warn(
      { raw },
      "Invalid IDEMPOTENCY_TTL_SEC provided; falling back to default",
    );
    return DEFAULT_IDEMPOTENCY_TTL_SEC;
  }
  return parsed;
})();

const idempotencyCache = new Map<
  string,
  { expiresAt: number; statusCode: number; payload: unknown }
>();

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
  const keyHeader = req.headers["idempotency-key"];
  const idempotencyKey = Array.isArray(keyHeader)
    ? keyHeader[0]
    : keyHeader;
  if (
    !idempotencyKey ||
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length === 0
  ) {
    return rep.code(400).send({ error: "missing_idempotency_key" });
  }

  const normalizedKey = idempotencyKey.trim();

  const cached = idempotencyCache.get(normalizedKey);
  const now = Date.now();
  if (cached) {
    if (cached.expiresAt >= now) {
      return rep.code(cached.statusCode).send(cached.payload);
    }
    idempotencyCache.delete(normalizedKey);
  }

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

    const response = {
      statusCode: 201,
      payload: created,
    };

    idempotencyCache.set(normalizedKey, {
      ...response,
      expiresAt: Date.now() + IDEMPOTENCY_TTL_SEC * 1000,
    });

    return rep.code(response.statusCode).send(response.payload);
  } catch (e) {
    req.log.error(e);

    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return rep.code(409).send({ error: "bank_line_conflict" });
    }

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

