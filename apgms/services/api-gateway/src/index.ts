import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type PrismaClientLike = {
  user: { findMany: (...args: any[]) => Promise<any> };
  bankLine: {
    findMany: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
  };
};

export type BuildAppOptions = {
  prismaClient?: PrismaClientLike;
  extend?: (app: FastifyInstance) => void | Promise<void>;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: true });
  const db =
    options.prismaClient ?? (await import("../../../shared/src/db")).prisma;

  const allowedOrigins = new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  await app.register(helmet);
  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
    timeWindow: "1 minute",
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      const error = new Error("Origin not allowed");
      error.name = "CorsError";
      (error as any).statusCode = 403;
      callback(error, false);
    },
  });

  app.addHook("onRequest", async (req) => {
    const headerValue = req.headers["x-request-id"];
    const requestId = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    (req as any).reqId = requestId ?? randomUUID();
  });

  app.addHook("onSend", async (req, reply, payload) => {
    if (!MUTATION_METHODS.has(req.method)) {
      return payload;
    }

    const auditEvent = {
      audit: true,
      method: req.method,
      url: req.url,
      statusCode: reply.statusCode,
      reqId: (req as any).reqId,
      userId: (req as any).user?.id,
      orgId: (req as any).orgId,
    };

    app.log.info(auditEvent);

    return payload;
  });

  if (options.extend) {
    await options.extend(app);
  }

  // sanity log: confirm env is loaded
  app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  // List users (email + org)
  app.get("/users", async () => {
    const users = await db.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  // List bank lines (latest first)
  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await db.bankLine.findMany({
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
      const created = await db.bankLine.create({
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

  return app;
}

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

let appInstance: Awaited<ReturnType<typeof buildApp>> | undefined;

if (process.env.NODE_ENV !== "test") {
  appInstance = await buildApp();

  appInstance
    .listen({ port, host })
    .catch((err) => {
      appInstance?.log.error(err);
      process.exit(1);
    });
}

export const app = appInstance;
