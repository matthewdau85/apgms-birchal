import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

dotenv.config();

import Fastify, { FastifyInstance, RouteOptions } from "fastify";
import { prisma } from "@apgms/shared/src/db";
import { registerSecurity } from "./plugins/security";
import { registerHealthRoutes } from "./routes/health";
import { registerWebhookRoutes } from "./routes/webhooks";
import { authenticateRequest } from "./middleware/auth";
import { enforceOrgScope } from "./middleware/org-scope";
import {
  getUsersQuerySchema,
  getUsersResponseSchema,
} from "./schemas/users";
import {
  listBankLinesQuerySchema,
  listBankLinesResponseSchema,
  createBankLineBodySchema,
  createBankLineResponseSchema,
} from "./schemas/bank-lines";
import {
  getOrSet,
  IdempotencyConflictError,
  IdempotencyInProgressError,
  closeIdempotencyStore,
} from "./lib/idempotency";

function addSecurityHandlers(routeOptions: RouteOptions): boolean {
  const url = routeOptions.url ?? "";
  if (url.startsWith("/healthz") || url.startsWith("/readyz") || url.startsWith("/webhooks")) {
    return false;
  }
  const preHandlers = Array.isArray(routeOptions.preHandler)
    ? [...routeOptions.preHandler]
    : routeOptions.preHandler
      ? [routeOptions.preHandler]
      : [];
  routeOptions.preHandler = [authenticateRequest, enforceOrgScope, ...preHandlers];
  return true;
}

function registerReplyValidation(app: FastifyInstance) {
  app.addHook("preSerialization", (request, reply, payload, done) => {
    const config = (reply.context as any)?.config;
    const schema = config?.replySchema;
    if (!schema) {
      done(null, payload);
      return;
    }
    try {
      const parsed = schema.parse(payload);
      done(null, parsed);
    } catch (error) {
      done(error as Error);
    }
  });
}

type BankLineDto = {
  id: string;
  orgId: string;
  date: string;
  amountCents: number;
  payee: string;
  description: string;
  createdAt: string;
};

type CreateBankLineResult = {
  statusCode: number;
  body: { bankLine: BankLineDto };
};

function normalizeAmountCents(amount: unknown): number {
  if (typeof amount === "number") {
    return Math.trunc(amount);
  }
  if (typeof amount === "string") {
    const parsed = Number(amount);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  if (amount && typeof (amount as any).toString === "function") {
    const parsed = Number((amount as any).toString());
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  throw new Error("invalid_amount");
}

function toBankLineDto(bankLine: {
  id: string;
  orgId: string;
  date: Date;
  amount: unknown;
  payee: string;
  desc: string;
  createdAt: Date;
}): BankLineDto {
  return {
    id: bankLine.id,
    orgId: bankLine.orgId,
    date: bankLine.date.toISOString(),
    amountCents: normalizeAmountCents(bankLine.amount),
    payee: bankLine.payee,
    description: bankLine.desc,
    createdAt: bankLine.createdAt.toISOString(),
  };
}

function toUserDto(user: {
  id: string;
  email: string;
  orgId: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    orgId: user.orgId,
    createdAt: user.createdAt.toISOString(),
  };
}

function buildUsersRoute(app: FastifyInstance) {
  app.route({
    method: "GET",
    url: "/users",
    config: {
      replySchema: getUsersResponseSchema,
    },
    async handler(request) {
      const query = getUsersQuerySchema.parse(request.query ?? {});
      const limit = query.limit ?? 50;

      const prismaQuery: Parameters<typeof prisma.user.findMany>[0] = {
        where: { orgId: request.orgId! },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        select: { id: true, email: true, orgId: true, createdAt: true },
      };

      if (query.cursor) {
        prismaQuery.cursor = { id: query.cursor };
        prismaQuery.skip = 1;
      }

      const results = await prisma.user.findMany(prismaQuery);
      const items = results.slice(0, limit);
      const nextCursor = results.length > limit ? results[limit]?.id ?? null : null;

      return getUsersResponseSchema.parse({
        users: items.map(toUserDto),
        nextCursor,
      });
    },
  });
}

function buildBankLineRoutes(app: FastifyInstance) {
  app.route({
    method: "GET",
    url: "/bank-lines",
    config: {
      replySchema: listBankLinesResponseSchema,
    },
    async handler(request) {
      const query = listBankLinesQuerySchema.parse(request.query ?? {});
      const limit = query.limit ?? 50;

      const prismaQuery: Parameters<typeof prisma.bankLine.findMany>[0] = {
        where: { orgId: request.orgId! },
        orderBy: { date: "desc" },
        take: limit + 1,
      };

      if (query.cursor) {
        prismaQuery.cursor = { id: query.cursor };
        prismaQuery.skip = 1;
      }

      const results = await prisma.bankLine.findMany(prismaQuery);
      const items = results.slice(0, limit);
      const nextCursor = results.length > limit ? results[limit]?.id ?? null : null;

      return listBankLinesResponseSchema.parse({
        bankLines: items.map(toBankLineDto),
        nextCursor,
      });
    },
  });

  app.route({
    method: "POST",
    url: "/bank-lines",
    config: {
      replySchema: createBankLineResponseSchema,
    },
    async handler(request, reply) {
      const body = createBankLineBodySchema.parse(request.body ?? {});
      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
        return reply.code(400).send({ error: "idempotency_key_required" });
      }

      const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");

      try {
        const result = await getOrSet<CreateBankLineResult>(
          idempotencyKey,
          hash,
          async () => {
            const created = await prisma.bankLine.create({
              data: {
                orgId: body.orgId,
                date: new Date(body.date),
                amount: body.amountCents,
                payee: body.payee,
                desc: body.description,
              },
            });

            return {
              statusCode: 201,
              body: createBankLineResponseSchema.parse({
                bankLine: toBankLineDto(created),
              }),
            } satisfies CreateBankLineResult;
          },
        );

        return reply.code(result.statusCode).send(result.body);
      } catch (error) {
        if (error instanceof IdempotencyConflictError) {
          return reply.code(409).send({ error: "idempotency_conflict" });
        }
        if (error instanceof IdempotencyInProgressError) {
          return reply.code(409).send({ error: "idempotency_in_progress" });
        }
        request.log.error({ err: error }, "failed to create bank line");
        return reply.code(500).send({ error: "server_error" });
      }
    },
  });
}

export async function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 512 * 1024 });

  await registerSecurity(app);
  registerReplyValidation(app);

  app.addHook("onRoute", addSecurityHandlers);

  registerHealthRoutes(app);
  await registerWebhookRoutes(app);
  buildUsersRoute(app);
  buildBankLineRoutes(app);

  return app;
}

export function createShutdownHandler(app: FastifyInstance) {
  let closing = false;
  return async (signal: NodeJS.Signals) => {
    if (closing) {
      return;
    }
    closing = true;
    app.log.info({ signal }, "graceful shutdown initiated");
    try {
      await app.close();
      await prisma.$disconnect();
      await closeIdempotencyStore();
      app.log.info("shutdown complete");
      if (process.env.NODE_ENV !== "test") {
        process.exit(0);
      }
    } catch (error) {
      app.log.error({ err: error }, "error during shutdown");
      if (process.env.NODE_ENV !== "test") {
        process.exit(1);
      }
    }
  };
}

async function start() {
  const app = await buildApp();

  const port = Number(process.env.PORT ?? 3000);
  const host = "0.0.0.0";

  const shutdown = createShutdownHandler(app);
  ["SIGTERM", "SIGINT"].forEach((signal) => {
    process.once(signal as NodeJS.Signals, () => {
      void shutdown(signal as NodeJS.Signals);
    });
  });

  try {
    await app.listen({ port, host });
    app.log.info({ port, host }, "api-gateway listening");
  } catch (error) {
    app.log.error({ err: error }, "failed to start server");
    await shutdown("SIGTERM");
  }
}

if (process.env.NODE_ENV !== "test") {
  void start();
}
