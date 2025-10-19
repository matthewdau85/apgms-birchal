import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

dotenv.config();

import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import fp from "fastify-plugin";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import {
  prisma,
  createAccessTokenVerifier,
  AuthenticationError,
  recordAuditEvent,
  type AuthContext,
} from "@apgms/shared";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

const loggerRedactions = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.password",
  "res.headers.authorization",
  "res.headers['set-cookie']",
];

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    redact: loggerRedactions,
  },
  bodyLimit: Number(process.env.REQUEST_BODY_LIMIT ?? 1024 * 64),
  trustProxy: true,
});

await app.register(sensible);
await app.register(helmet, { global: true, contentSecurityPolicy: false });

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOriginsSet = new Set(allowedOrigins);

await app.register(cors, {
  credentials: true,
  origin: (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }

    if (allowedOriginsSet.has(origin)) {
      cb(null, true);
      return;
    }

    cb(new Error("origin_not_allowed"), false);
  },
});

const verifier = createAccessTokenVerifier({
  issuer: process.env.AUTH_JWT_ISSUER,
  audience: process.env.AUTH_JWT_AUDIENCE,
  jwksUrl: process.env.AUTH_JWKS_URL,
  sharedSecret: process.env.AUTH_SHARED_SECRET,
  allowedClockSkewSeconds: Number(process.env.AUTH_CLOCK_SKEW ?? 60),
});

const authenticationPlugin = fp(async (instance) => {
  instance.decorateRequest("auth", null as unknown as AuthContext);

  instance.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.config?.public) {
      return;
    }

    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw instance.httpErrors.unauthorized("missing_bearer_token");
    }

    const token = header.slice("Bearer ".length);
    try {
      request.auth = await verifier(token);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error.statusCode === 401
          ? instance.httpErrors.unauthorized(error.reason)
          : instance.httpErrors.forbidden(error.reason);
      }
      request.log.error({ err: error }, "auth_verification_failed");
      throw instance.httpErrors.internalServerError();
    }
  });
});

await app.register(authenticationPlugin);

await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_MAX ?? 120),
  timeWindow: process.env.RATE_LIMIT_WINDOW ?? "1 minute",
  hook: "onSend",
  addHeaders: {
    "x-ratelimit-limit": true,
    "x-ratelimit-remaining": true,
    "x-ratelimit-reset": true,
  },
});

const requireRole = (request: FastifyRequest, role: string) => {
  if (!request.auth.roles.has(role)) {
    throw request.server.httpErrors.forbidden("role_required");
  }
};

const requireScope = (request: FastifyRequest, scope: string) => {
  if (!request.auth.scopes.has(scope) && !request.auth.roles.has(scope)) {
    throw request.server.httpErrors.forbidden("scope_required");
  }
};

const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9:_-]+$/);

const bankLineSchema = z.object({
  orgId: z.string().cuid(),
  date: z.string().datetime(),
  amount: z.union([z.string(), z.number()]),
  payee: z.string().min(1).max(256),
  desc: z.string().min(1).max(512),
});

const bankLineQuerySchema = z.object({
  take: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .pipe(z.number().int().positive().max(200).optional()),
});

const deleteUserParamsSchema = z.object({
  userId: z.string().cuid(),
});

const withIdempotency = async <T>(
  request: FastifyRequest,
  key: string,
  handler: () => Promise<{ body: T; statusCode?: number }>
): Promise<{ body: T; statusCode: number; replayed: boolean }> => {
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key_userId: { key, userId: request.auth.userId } },
  });

  if (existing) {
    request.log.info({ key }, "idempotency_replay");
    return {
      body: existing.responseBody as T,
      statusCode: existing.responseCode,
      replayed: true,
    };
  }

  const { body, statusCode = 200 } = await handler();

  await prisma.idempotencyKey.create({
    data: {
      key,
      userId: request.auth.userId,
      orgId: request.auth.orgId,
      method: request.method,
      route: request.routerPath ?? request.url,
      responseCode: statusCode,
      responseBody: body as unknown as Prisma.JsonValue,
    },
  });

  return { body, statusCode, replayed: false };
};

const sanitizeBankLine = (line: { id: string; date: Date; amount: unknown; payee: string; desc: string }) => {
  let amount: string;
  if (line.amount && typeof line.amount === "object" && "toString" in line.amount) {
    amount = (line.amount as { toString(): string }).toString();
  } else {
    amount = String(line.amount ?? "0");
  }

  return {
    id: line.id,
    date: line.date.toISOString(),
    amount,
    payee: line.payee,
    desc: line.desc,
  };
};

app.get(
  "/health",
  { config: { public: true } },
  async (request) => {
    const key = request.headers["x-health-check-key"];
    if (!process.env.HEALTH_CHECK_KEY || key !== process.env.HEALTH_CHECK_KEY) {
      throw app.httpErrors.unauthorized("invalid_health_check_key");
    }

    return { ok: true, service: "api-gateway", timestamp: new Date().toISOString() };
  }
);

app.get(
  "/ready",
  { config: { public: true } },
  async (request) => {
    const key = request.headers["x-health-check-key"];
    if (!process.env.HEALTH_CHECK_KEY || key !== process.env.HEALTH_CHECK_KEY) {
      throw app.httpErrors.unauthorized("invalid_health_check_key");
    }

    await prisma.$queryRaw`SELECT 1`;

    return { ok: true, service: "api-gateway", timestamp: new Date().toISOString() };
  }
);

app.get("/users", async (request) => {
  requireRole(request, "admin");

  const users = await prisma.user.findMany({
    where: { orgId: request.auth.orgId },
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  await recordAuditEvent({
    userId: request.auth.userId,
    orgId: request.auth.orgId,
    action: "users.list",
    target: request.auth.orgId,
    ipAddress: request.ip,
    meta: { count: users.length },
  });

  return {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    })),
  };
});

app.get("/bank-lines", async (request) => {
  requireScope(request, "finance:read");

  const query = bankLineQuerySchema.parse(request.query ?? {});
  const take = query.take ?? 20;

  const lines = await prisma.bankLine.findMany({
    where: { orgId: request.auth.orgId },
    orderBy: { date: "desc" },
    take,
  });

  await recordAuditEvent({
    userId: request.auth.userId,
    orgId: request.auth.orgId,
    action: "bank_lines.list",
    ipAddress: request.ip,
    meta: { take },
  });

  return { lines: lines.map(sanitizeBankLine) };
});

app.post("/bank-lines", async (request, reply) => {
  requireScope(request, "finance:write");

  const idempotencyKey = request.headers["idempotency-key"];
  if (typeof idempotencyKey !== "string") {
    throw app.httpErrors.badRequest("missing_idempotency_key");
  }

  const key = idempotencyKeySchema.parse(idempotencyKey);
  const body = bankLineSchema.parse(request.body ?? {});

  if (body.orgId !== request.auth.orgId) {
    throw app.httpErrors.forbidden("org_scope_violation");
  }

  const result = await withIdempotency(request, key, async () => {
    const created = await prisma.bankLine.create({
      data: {
        orgId: request.auth.orgId,
        date: new Date(body.date),
        amount: body.amount,
        payee: body.payee,
        desc: body.desc,
      },
    });

    return {
      body: { line: sanitizeBankLine(created) },
      statusCode: 201,
    };
  });

  await recordAuditEvent({
    userId: request.auth.userId,
    orgId: request.auth.orgId,
    action: "bank_lines.create",
    target: result.body.line?.id,
    ipAddress: request.ip,
    meta: { replayed: result.replayed },
  });

  return reply
    .header("idempotency-replayed", result.replayed ? "true" : "false")
    .code(result.statusCode)
    .send(result.body);
});

app.get("/privacy/export", async (request) => {
  requireScope(request, "privacy:export");

  const [org, users, lines] = await Promise.all([
    prisma.org.findUnique({ where: { id: request.auth.orgId } }),
    prisma.user.findMany({
      where: { orgId: request.auth.orgId },
      select: { id: true, email: true, createdAt: true },
    }),
    prisma.bankLine.findMany({
      where: { orgId: request.auth.orgId },
      orderBy: { date: "desc" },
    }),
  ]);

  if (!org) {
    throw app.httpErrors.notFound("org_not_found");
  }

  const payload = {
    org: { id: org.id, name: org.name, createdAt: org.createdAt.toISOString() },
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    })),
    bankLines: lines.map(sanitizeBankLine),
  };

  await recordAuditEvent({
    userId: request.auth.userId,
    orgId: request.auth.orgId,
    action: "privacy.export",
    ipAddress: request.ip,
    meta: { users: payload.users.length, lines: payload.bankLines.length },
  });

  return payload;
});

app.delete("/privacy/users/:userId", async (request, reply) => {
  requireScope(request, "privacy:delete");

  const params = deleteUserParamsSchema.parse(request.params ?? {});

  if (params.userId === request.auth.userId) {
    throw app.httpErrors.badRequest("cannot_delete_self");
  }

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user || user.orgId !== request.auth.orgId) {
    throw app.httpErrors.notFound("user_not_found");
  }

  await prisma.user.delete({ where: { id: user.id } });

  await recordAuditEvent({
    userId: request.auth.userId,
    orgId: request.auth.orgId,
    action: "privacy.user.delete",
    target: user.id,
    ipAddress: request.ip,
    meta: { email: user.email },
  });

  return reply.code(204).send();
});

app.addHook("onResponse", async (request, reply) => {
  if (!request.routeOptions.config?.public) {
    request.log.info(
      {
        route: request.routerPath,
        statusCode: reply.statusCode,
        userId: request.auth?.userId,
        orgId: request.auth?.orgId,
      },
      "request_completed"
    );
  }
});

app.ready(() => {
  app.log.info({ routes: app.printRoutes() }, "routes_registered");
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

const closeGracefully = async () => {
  app.log.info("received_shutdown_signal");
  try {
    await app.close();
    await prisma.$disconnect();
  } catch (error) {
    app.log.error({ err: error }, "shutdown_error");
  } finally {
    process.exit(0);
  }
};

process.once("SIGTERM", closeGracefully);
process.once("SIGINT", closeGracefully);

app
  .listen({ port, host })
  .then(() => {
    app.log.info({ port, host }, "api_gateway_started");
  })
  .catch((err) => {
    app.log.error(err, "startup_error");
    process.exit(1);
  });
