import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import type { FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";

import { setupTracing } from "./tracing";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export interface CreateAppOptions {
  logger?: FastifyServerOptions["logger"];
  enableTracing?: boolean;
  prisma?: PrismaClient;
}

type RequestWithStart = {
  __startTimeNs?: bigint;
};

type PrismaClient = typeof import("../../../shared/src/db").prisma;

function extractOrgId(request: import("fastify").FastifyRequest): string | undefined {
  const headerOrg = request.headers["x-org-id"] ?? request.headers["x-orgid"];
  if (typeof headerOrg === "string") {
    return headerOrg;
  }
  if (Array.isArray(headerOrg)) {
    return headerOrg[0];
  }

  const body = request.body;
  if (body && typeof body === "object" && "orgId" in body) {
    const value = (body as Record<string, unknown>).orgId;
    if (typeof value === "string") {
      return value;
    }
  }

  const query = request.query;
  if (query && typeof query === "object" && "orgId" in query) {
    const value = (query as Record<string, unknown>).orgId;
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const enableTracing = options.enableTracing ?? process.env.ENABLE_OTEL_TRACES === "true";
  const logger: FastifyServerOptions["logger"] = options.logger ?? true;
  const prismaClient = options.prisma ?? (await import("../../../shared/src/db")).prisma;

  const app = Fastify({ logger });

  const tracing = enableTracing ? setupTracing("api-gateway", app.log as FastifyBaseLogger) : undefined;

  await app.register(cors, { origin: true });

  app.addHook("onRequest", (request, _reply, done) => {
    (request as typeof request & RequestWithStart).__startTimeNs = process.hrtime.bigint();
    if (tracing) {
      tracing.onRequest(request);
    }
    done();
  });

  app.addHook("onResponse", async (request, reply) => {
    const start = (request as typeof request & RequestWithStart).__startTimeNs;
    const latencyNs = start !== undefined ? Number(process.hrtime.bigint() - start) : undefined;
    const latencyMs = latencyNs !== undefined ? latencyNs / 1_000_000 : undefined;

    const orgId = extractOrgId(request) ?? null;
    const route = request.routeOptions?.url ?? request.routerPath ?? request.raw.url;

    if (tracing) {
      await tracing.onResponse(request, reply);
    }

    request.log.info(
      {
        requestId: request.id,
        orgId,
        route,
        status: reply.statusCode,
        latencyMs,
      },
      "request completed",
    );
  });

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  // List users (email + org)
  app.get("/users", async () => {
    const users = await prismaClient.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  // List bank lines (latest first)
  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prismaClient.bankLine.findMany({
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
      const created = await prismaClient.bankLine.create({
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

  // Print routes so we can SEE POST /bank-lines is registered
  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  if (tracing) {
    app.addHook("onClose", async () => {
      await tracing.shutdown();
    });
  }

  return app;
}
