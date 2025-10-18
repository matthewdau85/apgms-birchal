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
import { createLogger } from "../../../shared/src/observability/logger";
import {
  createHttpMetrics,
  createMetricsRegistry,
} from "../../../shared/src/observability/metrics";

declare module "fastify" {
  interface FastifyRequest {
    metricsEndTimer?: (labels?: Record<string, string | number>) => void;
  }
}

const serviceName = process.env.SERVICE_NAME ?? "api-gateway";
const logger = createLogger({ serviceName });
const metricsRegistry = createMetricsRegistry({ serviceName });
const httpMetrics = createHttpMetrics(metricsRegistry);

const app = Fastify({ logger });

await app.register(cors, { origin: true });

// sanity log: confirm env is loaded
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.addHook("onRequest", async (req) => {
  const route = req.routeOptions.url ?? req.url;
  req.metricsEndTimer = httpMetrics.requestDuration.startTimer({
    method: req.method,
    route,
  });
});

app.addHook("onResponse", async (req, rep) => {
  const route = req.routeOptions.url ?? req.url;
  const statusCode = rep.statusCode;
  httpMetrics.requestCount.inc({
    method: req.method,
    route,
    status_code: String(statusCode),
  });
  req.metricsEndTimer?.({
    method: req.method,
    route,
    status_code: String(statusCode),
  });
});

app.get("/metrics", async (_req, rep) => {
  rep.header("Content-Type", metricsRegistry.contentType);
  return rep.send(await metricsRegistry.metrics());
});

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

// Print routes so we can SEE POST /bank-lines is registered
app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app
  .listen({ port, host })
  .then(() => {
    app.log.info({ port, host }, "api gateway listening");
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

