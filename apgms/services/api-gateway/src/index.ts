import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@apgms/shared/src/db";
import { z } from "zod";

import { openApiDocument, swaggerUiHtml } from "./openapi";
import { parseDurationSeconds } from "./utils/duration";
import { isAccessToken, isRefreshToken, signJwt, verifyJwt } from "./utils/jwt";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type IdempotencyEntry = {
  statusCode: number;
  payload: unknown;
  contentType?: string;
  expiresAt: number;
};

const ensurePositiveNumber = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const idempotencyStore = new Map<string, IdempotencyEntry>();

const rateLimitWindowMs = ensurePositiveNumber(
  Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  60_000,
);
const rateLimitMax = ensurePositiveNumber(Number(process.env.RATE_LIMIT_MAX ?? 100), 100);
const idempotencyTtlMs = ensurePositiveNumber(
  Number(process.env.IDEMPOTENCY_TTL_MS ?? 60 * 60 * 1000),
  60 * 60 * 1000,
);
const jwtSecret = process.env.JWT_SECRET ?? "local-dev-secret";
const jwtIssuer = process.env.JWT_ISSUER ?? "apgms-api-gateway";
const accessTtlSeconds = parseDurationSeconds(process.env.JWT_ACCESS_TTL, 15 * 60);
const refreshTtlSeconds = parseDurationSeconds(process.env.JWT_REFRESH_TTL, 7 * 24 * 60 * 60);
const docsEnabled = process.env.API_GATEWAY_DOCS === "true";
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.password",
  "req.body.refreshToken",
];

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    redact: { paths: redactPaths, censor: "[REDACTED]" },
  },
  genReqId: (request) => {
    const incomingHeader = request.headers["x-request-id"];
    if (typeof incomingHeader === "string" && incomingHeader.trim() !== "") {
      return incomingHeader;
    }
    if (Array.isArray(incomingHeader) && incomingHeader.length > 0) {
      return incomingHeader[0];
    }
    return randomUUID();
  },
});

const pruneRateLimitBuckets = (now: number) => {
  for (const [key, entry] of rateLimitBuckets) {
    if (entry.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
};

const pruneIdempotency = (now: number) => {
  for (const [key, entry] of idempotencyStore) {
    if (entry.expiresAt <= now) {
      idempotencyStore.delete(key);
    }
  }
};

app.addHook("onRequest", async (request, reply) => {
  if (rateLimitMax <= 0) {
    return;
  }
  const now = Date.now();
  pruneRateLimitBuckets(now);
  const key = request.ip ?? request.socket.remoteAddress ?? "unknown";
  const bucket = rateLimitBuckets.get(key);
  if (!bucket) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return;
  }

  if (bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return;
  }

  if (bucket.count >= rateLimitMax) {
    reply.header("retry-after", Math.ceil((bucket.resetAt - now) / 1000));
    await reply.code(429).send({ error: "too_many_requests" });
    return;
  }

  bucket.count += 1;
});

app.addHook("preHandler", async (request, reply) => {
  if (request.method !== "POST" || idempotencyTtlMs <= 0) {
    return;
  }
  const keyHeader = request.headers["idempotency-key"] ?? request.headers["x-idempotency-key"];
  const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
  if (!key || typeof key !== "string") {
    return;
  }
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    return;
  }
  request.idempotencyKey = trimmedKey;
  const now = Date.now();
  pruneIdempotency(now);
  const entry = idempotencyStore.get(trimmedKey);
  if (entry && entry.expiresAt > now) {
    if (entry.contentType) {
      reply.header("content-type", entry.contentType);
    }
    reply.header("x-idempotent-replay", "true");
    reply.code(entry.statusCode);
    await reply.send(entry.payload);
    return;
  } else if (entry && entry.expiresAt <= now) {
    idempotencyStore.delete(trimmedKey);
  }
});

app.addHook("onSend", async (request, reply, payload) => {
  if (!reply.hasHeader("x-request-id")) {
    reply.header("x-request-id", request.id);
  }

  if (
    request.method === "POST" &&
    request.idempotencyKey &&
    reply.statusCode < 500 &&
    idempotencyTtlMs > 0
  ) {
    pruneIdempotency(Date.now());
    const storedPayload = Buffer.isBuffer(payload)
      ? Buffer.from(payload)
      : typeof payload === "string"
        ? payload
        : payload === undefined
          ? payload
          : JSON.parse(JSON.stringify(payload));
    idempotencyStore.set(request.idempotencyKey, {
      statusCode: reply.statusCode,
      payload: storedPayload,
      contentType: reply.getHeader("content-type")?.toString(),
      expiresAt: Date.now() + idempotencyTtlMs,
    });
  }

  return payload;
});

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

await app.register(cors, { origin: true });

app.decorate(
  "authenticate",
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    try {
      const claims = verifyJwt(token, jwtSecret);
      if (!isAccessToken(claims) || claims.iss !== jwtIssuer) {
        await reply.code(401).send({ error: "unauthorized" });
        return;
      }
      request.authUser = claims;
    } catch (err) {
      request.log.warn({ err }, "failed to verify token");
      await reply.code(401).send({ error: "unauthorized" });
    }
  },
);

const requireRoles = (roles: string[]) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.authUser;
    if (!user) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    if (!roles.some((role) => user.roles.includes(role))) {
      await reply.code(403).send({ error: "forbidden" });
      return;
    }
  };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const bankLineBodySchema = z
  .object({
    orgId: z.string().min(1).optional(),
    date: z.preprocess((value) => {
      if (value instanceof Date) return value;
      if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        return parsed;
      }
      return value;
    }, z.date()),
    amount: z.preprocess((value) => {
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : value;
      }
      return value;
    }, z.number().finite()),
    payee: z.string().min(1),
    desc: z.string().min(1),
  })
  .refine((input) => !Number.isNaN(input.date.getTime()), {
    path: ["date"],
    message: "Invalid date",
  });

const bankLineQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
});

const deriveRoles = (_email: string) => ["ORG_ADMIN"];

const issueTokens = (claims: { sub: string; orgId: string; roles: string[] }) => ({
  accessToken: signJwt(claims, {
    secret: jwtSecret,
    issuer: jwtIssuer,
    expiresInSeconds: accessTtlSeconds,
    tokenType: "access",
  }),
  refreshToken: signJwt(claims, {
    secret: jwtSecret,
    issuer: jwtIssuer,
    expiresInSeconds: refreshTtlSeconds,
    tokenType: "refresh",
  }),
  tokenType: "Bearer" as const,
  expiresIn: accessTtlSeconds,
});

app.setErrorHandler(async (error, request, reply) => {
  if (error instanceof z.ZodError) {
    await reply.code(400).send({ error: "validation_error", details: error.flatten() });
    return;
  }
  request.log.error({ err: error }, "unhandled error");
  await reply.code(500).send({ error: "internal_error" });
});

app.log.info(
  { databaseConfigured: Boolean(process.env.DATABASE_URL), docsEnabled },
  "api gateway starting",
);

app.get("/health", async () => ({ status: "ok" }));

app.post("/auth/login", async (request, reply) => {
  const body = loginSchema.parse(request.body ?? {});
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || user.password !== body.password) {
    await reply.code(401).send({ error: "invalid_credentials" });
    return;
  }
  const roles = deriveRoles(user.email);
  const tokens = issueTokens({ sub: user.id, orgId: user.orgId, roles });
  reply.header("cache-control", "no-store");
  await reply.send(tokens);
});

app.post("/auth/refresh", async (request, reply) => {
  const body = refreshSchema.parse(request.body ?? {});
  try {
    const claims = verifyJwt(body.refreshToken, jwtSecret);
    if (!isRefreshToken(claims) || claims.iss !== jwtIssuer) {
      await reply.code(401).send({ error: "invalid_refresh_token" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) {
      await reply.code(401).send({ error: "invalid_refresh_token" });
      return;
    }
    const tokens = issueTokens({ sub: user.id, orgId: user.orgId, roles: claims.roles });
    reply.header("cache-control", "no-store");
    await reply.send(tokens);
  } catch (err) {
    request.log.warn({ err }, "failed to refresh token");
    await reply.code(401).send({ error: "invalid_refresh_token" });
  }
});

app.get(
  "/users",
  { preHandler: [app.authenticate, requireRoles(["ORG_ADMIN"])], logLevel: "info" },
  async (request, reply) => {
    const user = request.authUser;
    if (!user) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const users = await prisma.user.findMany({
      where: { orgId: user.orgId },
      select: { id: true, email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    await reply.send({ users });
  },
);

app.get(
  "/bank-lines",
  { preHandler: [app.authenticate] },
  async (request, reply) => {
    const user = request.authUser;
    if (!user) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const query = bankLineQuerySchema.parse(request.query ?? {});
    const lines = await prisma.bankLine.findMany({
      where: { orgId: user.orgId },
      orderBy: { date: "desc" },
      take: query.take ?? 20,
    });
    await reply.send({ lines });
  },
);

app.post(
  "/bank-lines",
  { preHandler: [app.authenticate, requireRoles(["ORG_ADMIN"])], logLevel: "info" },
  async (request, reply) => {
    const user = request.authUser;
    if (!user) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const body = bankLineBodySchema.parse(request.body ?? {});
    const orgId = body.orgId ?? user.orgId;
    if (orgId !== user.orgId) {
      await reply.code(403).send({ error: "forbidden" });
      return;
    }
    const created = await prisma.bankLine.create({
      data: {
        orgId,
        date: body.date,
        amount: body.amount,
        payee: body.payee,
        desc: body.desc,
      },
    });
    await reply.code(201).send(created);
  },
);

if (docsEnabled) {
  app.get("/openapi.json", async () => openApiDocument);
  app.get("/docs", async (_, reply) => {
    return reply.type("text/html").send(swaggerUiHtml("/openapi.json"));
  });
}

app.ready().then(() => {
  app.log.info({ routes: app.printRoutes() }, "routes registered");
});

try {
  await app.listen({ host, port });
  app.log.info({ host, port }, "api gateway listening");
} catch (error) {
  app.log.error({ err: error }, "failed to start");
  process.exit(1);
}
