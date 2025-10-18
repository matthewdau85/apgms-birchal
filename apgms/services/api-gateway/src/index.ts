import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load repo-root .env from src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  childLogger,
  createServiceLogger,
  getActiveTraceContext,
  prisma,
  shutdownTelemetry,
  startTelemetry,
} from "../../../shared/src";

const baseLogger = createServiceLogger("api-gateway");

const telemetry = await startTelemetry({ serviceName: "api-gateway" }, baseLogger);

try {
  await prisma.$connect();
  baseLogger.info("database connected");
} catch (err) {
  baseLogger.error({ err }, "failed to connect to database");
  await shutdownTelemetry(telemetry, baseLogger);
  process.exit(1);
}

let shuttingDown = false;
let serverReady = false;

const app = Fastify({
  logger: baseLogger,
  disableRequestLogging: true,
  genReqId: (req) => req.headers["x-request-id"]?.toString() ?? randomUUID(),
  requestIdHeader: "x-request-id",
  requestIdLogLabel: "req_id",
});

await app.register(cors, { origin: true });

app.addHook("onRequest", async (req, reply) => {
  reply.header("x-request-id", req.id);
  (req as any).startTime = process.hrtime.bigint();
});

app.addHook("onResponse", async (req, reply) => {
  const start = (req as any).startTime as bigint | undefined;
  const durationNs = start ? process.hrtime.bigint() - start : undefined;
  const latencyMs = durationNs ? Number(durationNs) / 1_000_000 : undefined;
  const traceContext = getActiveTraceContext();

  const requestLogger = childLogger(req.log, {
    method: req.method,
    url: req.url,
    statusCode: reply.statusCode,
    latency_ms: latencyMs,
    trace_id: traceContext?.traceId,
    span_id: traceContext?.spanId,
  });
  requestLogger.info("request completed");
});

app.setErrorHandler((error, request, reply) => {
  const traceContext = getActiveTraceContext();
  const errorLogger = childLogger(request.log, {
    trace_id: traceContext?.traceId,
    span_id: traceContext?.spanId,
  });
  errorLogger.error({ err: error }, "request failed");
  const statusCode = "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
  reply.status(statusCode).send({ error: "internal_server_error" });
});

app.get("/healthz", async () => ({ status: "ok", service: "api-gateway" }));

app.get("/readyz", async (req, reply) => {
  if (!serverReady || shuttingDown) {
    return reply.status(503).send({ status: "starting" });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (err) {
    req.log.error({ err }, "readiness check failed");
    return reply.status(503).send({ status: "db_unavailable" });
  }
});

app.get("/users", async () => {
  const users = await prisma.user.findMany({
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users };
});

app.get("/bank-lines", async (req) => {
  const take = Number((req.query as any).take ?? 20);
  const lines = await prisma.bankLine.findMany({
    orderBy: { date: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
  return { lines };
});

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
    req.log.error({ err: e }, "failed to create bank line");
    return rep.code(400).send({ error: "bad_request" });
  }
});

app.ready(() => {
  app.log.info({ routes: app.printRoutes() }, "routes registered");
});

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  serverReady = false;
  baseLogger.info({ signal }, "received shutdown signal");
  try {
    await app.close();
    baseLogger.info("fastify server closed");
  } catch (err) {
    baseLogger.error({ err }, "failed to close fastify");
  }
  try {
    await prisma.$disconnect();
    baseLogger.info("prisma disconnected");
  } catch (err) {
    baseLogger.error({ err }, "failed to disconnect prisma");
  }
  await shutdownTelemetry(telemetry, baseLogger);
  baseLogger.info("shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

try {
  await app.listen({ port, host });
  serverReady = true;
  baseLogger.info({ port, host }, "api-gateway listening");
} catch (err) {
  baseLogger.error({ err }, "failed to start server");
  try {
    await prisma.$disconnect();
  } catch (disconnectErr) {
    baseLogger.error({ err: disconnectErr }, "failed to disconnect prisma during startup");
  }
  await shutdownTelemetry(telemetry, baseLogger);
  process.exit(1);
}
