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

const IDEMPOTENCY_TTL_MS = (() => {
  const seconds = Number(process.env.IDEMPOTENCY_TTL_SEC ?? "3600");
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  return 3600_000;
})();

type CachedResponse = {
  statusCode: number;
  payload: unknown;
  expiresAt: number;
};

const idempotencyCache = new Map<string, CachedResponse>();
const idempotencyInFlight = new Map<string, Promise<CachedResponse>>();

function getCachedResponse(key: string): CachedResponse | undefined {
  const cached = idempotencyCache.get(key);
  if (!cached) return undefined;

  if (cached.expiresAt <= Date.now()) {
    idempotencyCache.delete(key);
    return undefined;
  }

  return cached;
}

function setCachedResponse(key: string, response: CachedResponse) {
  idempotencyCache.set(key, response);
}

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
  const idempotencyKeyHeader = req.headers["idempotency-key"];
  const idempotencyKey = Array.isArray(idempotencyKeyHeader)
    ? idempotencyKeyHeader[0]
    : idempotencyKeyHeader;

  if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    return rep.code(400).send({ error: "missing_idempotency_key" });
  }

  const normalizedKey = idempotencyKey.trim();
  const cached = getCachedResponse(normalizedKey);
  if (cached) {
    return rep.code(cached.statusCode).send(cached.payload);
  }

  const inFlight = idempotencyInFlight.get(normalizedKey);
  if (inFlight) {
    try {
      const result = await inFlight;
      return rep.code(result.statusCode).send(result.payload);
    } catch (e) {
      req.log.error(e);
      return rep.code(400).send({ error: "bad_request" });
    }
  }

  const execute = (async (): Promise<CachedResponse> => {
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

    return {
      statusCode: 201,
      payload: created,
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    };
  })();

  idempotencyInFlight.set(normalizedKey, execute);

  try {
    const result = await execute;
    setCachedResponse(normalizedKey, result);
    return rep.code(result.statusCode).send(result.payload);
  } catch (e) {
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request" });
  } finally {
    idempotencyInFlight.delete(normalizedKey);
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

