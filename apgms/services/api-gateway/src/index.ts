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

const IDEMPOTENCY_TTL_SEC = (() => {
  const raw = Number(process.env.IDEMPOTENCY_TTL_SEC);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return 3600;
})();
const IDEMPOTENCY_TTL_MS = IDEMPOTENCY_TTL_SEC * 1000;

type FulfilledEntry = {
  state: "fulfilled";
  payloadHash: string;
  statusCode: number;
  responseBody: unknown;
  createdAt: number;
};

type PendingEntry = {
  state: "pending";
  payloadHash: string;
  createdAt: number;
  promise: Promise<FulfilledEntry>;
};

type CacheEntry = FulfilledEntry | PendingEntry;

const idempotencyCache = new Map<string, CacheEntry>();

const cleanupIntervalMs = Math.max(1000, Math.min(IDEMPOTENCY_TTL_MS, 60_000));
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache.entries()) {
    if (now - entry.createdAt > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}, cleanupIntervalMs);
cleanupTimer.unref?.();

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
  const keyHeader = req.headers["idempotency-key"];
  if (!keyHeader || Array.isArray(keyHeader) || keyHeader.trim() === "") {
    return rep.code(400).send({ error: "missing_idempotency_key" });
  }

  const idempotencyKey = keyHeader;
  const body = (req.body ?? {}) as {
    orgId: string;
    date: string;
    amount: number | string;
    payee: string;
    desc: string;
  };
  const payloadHash = JSON.stringify(body);
  const now = Date.now();
  const existingEntry = idempotencyCache.get(idempotencyKey);

  if (existingEntry) {
    if (now - existingEntry.createdAt > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(idempotencyKey);
    } else {
      if (existingEntry.payloadHash !== payloadHash) {
        return rep.code(409).send({ error: "idempotency_key_conflict" });
      }
      if (existingEntry.state === "pending") {
        try {
          const fulfilled = await existingEntry.promise;
          return rep.code(fulfilled.statusCode).send(fulfilled.responseBody);
        } catch (error) {
          req.log.error(error);
          const fallback = idempotencyCache.get(idempotencyKey);
          if (fallback && fallback.state === "fulfilled") {
            return rep
              .code(fallback.statusCode)
              .send(fallback.responseBody);
          }
          return rep.code(500).send({ error: "idempotency_replay_failed" });
        }
      }
      return rep.code(existingEntry.statusCode).send(existingEntry.responseBody);
    }
  }

  try {
    const pendingPromise: Promise<FulfilledEntry> = (async () => {
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
        state: "fulfilled" as const,
        payloadHash,
        statusCode: 201,
        responseBody: created,
        createdAt: Date.now(),
      } satisfies FulfilledEntry;
    })();

    const pendingEntry: PendingEntry = {
      state: "pending",
      payloadHash,
      createdAt: now,
      promise: pendingPromise,
    };

    idempotencyCache.set(idempotencyKey, pendingEntry);

    const fulfilled = await pendingPromise;
    idempotencyCache.set(idempotencyKey, fulfilled);
    return rep.code(fulfilled.statusCode).send(fulfilled.responseBody);
  } catch (error: any) {
    req.log.error(error);

    const isDuplicate = error?.code === "P2002";
    const statusCode = isDuplicate ? 409 : 400;
    const responseBody = isDuplicate
      ? { error: "duplicate_bank_line" }
      : { error: "bad_request" };

    const fulfilled: FulfilledEntry = {
      state: "fulfilled",
      payloadHash,
      statusCode,
      responseBody,
      createdAt: Date.now(),
    };

    idempotencyCache.set(idempotencyKey, fulfilled);

    return rep.code(statusCode).send(responseBody);
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

