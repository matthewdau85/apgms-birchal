import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyInstance, type FastifyPluginAsync } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "../../../shared/src/db";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const parsedRateLimit = Number(process.env.RATE_LIMIT_RPM);
const requestsPerMinute = Number.isFinite(parsedRateLimit) && parsedRateLimit > 0 ? parsedRateLimit : 60;

const rateLimitPlugin = await loadRateLimitPlugin(app);

await app.register(rateLimitPlugin, {
  max: requestsPerMinute,
  timeWindow: "1 minute",
});

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

const isProduction = process.env.NODE_ENV === "production";
type CachedResponse = { status: number; payload: unknown };
const idempotencyCache = isProduction ? null : new Map<string, CachedResponse>();

// Create a bank line
app.post("/bank-lines", async (req, rep) => {
  let cacheKey: string | null = null;
  try {
    const body = req.body as {
      orgId: string;
      date: string;
      amount: number | string;
      payee: string;
      desc: string;
    };

    if (idempotencyCache && body?.orgId) {
      const headerValue = req.headers["idempotency-key"];
      if (typeof headerValue === "string" && headerValue.length > 0) {
        cacheKey = `${body.orgId}:${headerValue}`;
        const cached = idempotencyCache.get(cacheKey);
        if (cached) {
          return rep.code(cached.status).send(cached.payload);
        }
      }
    }

    const created = await prisma.bankLine.create({
      data: {
        orgId: body.orgId,
        date: new Date(body.date),
        amount: body.amount as any,
        payee: body.payee,
        desc: body.desc,
      },
    });

    if (cacheKey && idempotencyCache) {
      idempotencyCache.set(cacheKey, { status: 201, payload: created });
    }

    return rep.code(201).send(created);
  } catch (e) {
    req.log.error(e);
    const errorResponse = { error: "bad_request" } as const;
    if (cacheKey && idempotencyCache) {
      idempotencyCache.set(cacheKey, { status: 400, payload: errorResponse });
    }
    return rep.code(400).send(errorResponse);
  }
});

async function loadRateLimitPlugin(
  instance: FastifyInstance,
): Promise<FastifyPluginAsync<{ max: number; timeWindow: string | number }>> {
  try {
    const moduleId = "@fastify/rate-limit";
    const loaded = await import(moduleId);
    return (loaded.default ?? loaded) as FastifyPluginAsync<{
      max: number;
      timeWindow: string | number;
    }>;
  } catch (error) {
    instance.log.warn({ err: error }, "failed to load @fastify/rate-limit, falling back to in-memory limiter");
    return createFallbackRateLimitPlugin();
  }
}

function createFallbackRateLimitPlugin(): FastifyPluginAsync<{
  max: number;
  timeWindow: string | number;
}> {
  return async (instance, opts) => {
    const limit = Math.max(1, Number.isFinite(opts.max) ? opts.max : 60);
    const windowMs = Math.max(1, parseTimeWindow(opts.timeWindow));
    const hits = new Map<string, { count: number; resetAt: number }>();

    instance.addHook("onRequest", async (request, reply) => {
      const now = Date.now();
      const identifierHeader = request.headers["x-forwarded-for"];
      const identifier =
        (typeof identifierHeader === "string" && identifierHeader.split(",")[0]?.trim()) || request.ip;

      const existing = hits.get(identifier);
      if (!existing || now >= existing.resetAt) {
        hits.set(identifier, { count: 1, resetAt: now + windowMs });
        return;
      }

      existing.count += 1;
      if (existing.count > limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1_000));
        reply.header("retry-after", retryAfterSeconds);
        reply.code(429).send({ error: "rate_limit_exceeded" });
        return reply;
      }
    });
  };
}

function parseTimeWindow(value: string | number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const minuteMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(m|minute|minutes)$/);
    if (minuteMatch) {
      return Number.parseFloat(minuteMatch[1]) * 60_000;
    }
    const secondMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(s|second|seconds)$/);
    if (secondMatch) {
      return Number.parseFloat(secondMatch[1]) * 1_000;
    }
    const asNumber = Number(normalized);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }
  }

  return 60_000;
}

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

