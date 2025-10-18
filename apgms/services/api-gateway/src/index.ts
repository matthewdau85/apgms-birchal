import path from "node:path";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";

type IdempotencyEntry = {
  payloadHash: string;
  responseBody: Record<string, unknown>;
};

type NonceEntry = {
  timestamp: number;
  idempotencyKey: string;
  payloadHash: string;
};

const idempotencyStore = new Map<string, IdempotencyEntry>();
const nonceStore = new Map<string, NonceEntry>();
const FIVE_MINUTES_MS = 5 * 60 * 1000;

function purgeExpiredNonces(now: number) {
  for (const [nonce, entry] of nonceStore.entries()) {
    if (now - entry.timestamp > FIVE_MINUTES_MS) {
      nonceStore.delete(nonce);
    }
  }
}

function payloadHash(body: string) {
  return createHash("sha256").update(body).digest("hex");
}

function computeSignature(secret: string, timestamp: string, nonce: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest();
}

function normalizeTimestamp(value: string | string[]): number | null {
  if (Array.isArray(value)) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const asMs = numeric > 1e12 ? numeric : numeric * 1000;
  return asMs;
}

export async function buildApp(options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });
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

  app.post("/webhooks/payto", async (req, rep) => {
    const secret = process.env.PAYTO_WEBHOOK_SECRET;
    if (!secret) {
      req.log.error("PAYTO_WEBHOOK_SECRET is not configured");
      return rep.code(500).send({ error: "webhook_secret_unset" });
    }

    const idempotencyKeyHeader = req.headers["idempotency-key"];
    if (typeof idempotencyKeyHeader !== "string" || !idempotencyKeyHeader.trim()) {
      return rep.code(400).send({ error: "missing_idempotency_key" });
    }
    const idempotencyKey = idempotencyKeyHeader.trim();

    const nonceHeader = req.headers["x-payto-nonce"];
    if (typeof nonceHeader !== "string" || !nonceHeader.trim()) {
      return rep.code(400).send({ error: "missing_nonce" });
    }
    const nonce = nonceHeader.trim();

    const timestampHeader = req.headers["x-payto-timestamp"] ?? req.headers["x-payto-time"];
    const timestampMs = normalizeTimestamp(timestampHeader as string | string[]);
    if (timestampMs === null) {
      return rep.code(400).send({ error: "invalid_timestamp" });
    }

    const now = Date.now();
    if (Math.abs(now - timestampMs) > FIVE_MINUTES_MS) {
      return rep.code(400).send({ error: "stale_timestamp", message: "stale timestamp" });
    }

    const signatureHeader = req.headers["x-payto-signature"] ?? req.headers["x-signature"];
    if (typeof signatureHeader !== "string" || !signatureHeader.trim()) {
      return rep.code(401).send({ error: "missing_signature" });
    }

    const bodyString = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    const bodyHash = payloadHash(bodyString);

    const expectedSignature = computeSignature(secret, String(timestampHeader), nonce, bodyString);
    let providedSignature: Buffer;
    try {
      providedSignature = Buffer.from(signatureHeader.trim(), "hex");
    } catch (err) {
      req.log.warn({ err }, "invalid signature encoding");
      return rep.code(401).send({ error: "invalid_signature" });
    }
    if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) {
      return rep.code(401).send({ error: "invalid_signature" });
    }

    purgeExpiredNonces(now);
    const existingNonce = nonceStore.get(nonce);
    if (existingNonce) {
      if (existingNonce.idempotencyKey !== idempotencyKey || existingNonce.payloadHash !== bodyHash) {
        return rep.code(409).send({ error: "nonce_replay" });
      }
    } else {
      nonceStore.set(nonce, { timestamp: timestampMs, idempotencyKey, payloadHash: bodyHash });
    }

    const existing = idempotencyStore.get(idempotencyKey);
    if (existing) {
      if (existing.payloadHash !== bodyHash) {
        return rep.code(409).send({ error: "idempotency_conflict" });
      }
      return rep.code(200).send(existing.responseBody);
    }

    const responseBody = { status: "accepted", idempotencyKey } as const;
    idempotencyStore.set(idempotencyKey, { payloadHash: bodyHash, responseBody });

    return rep.code(202).send(responseBody);
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  await app.ready();
  return app;
}

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  app.listen({ port, host }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

const entryFile = fileURLToPath(import.meta.url);
if (process.argv[1] === entryFile) {
  start();
}
