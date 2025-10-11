// --- load ../../../../.env (repo root) from src ---
// src = apgms/services/api-gateway/src
// repo root .env = apgms/.env  ==> go up three levels
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import pino from "pino";
import client from "prom-client";
import { randomUUID } from "node:crypto";
import { context, trace, SpanStatusCode } from "@opentelemetry/api";
import {
  prisma,
  setupTracing,
  extractContextFromHeaders,
  injectContextToHeaders,
} from "../../../shared/src";

const serviceName = "api-gateway";
const tracer = setupTracing(serviceName);

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: serviceName },
});

const register = new client.Registry();
register.setDefaultLabels({ service: serviceName });
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Count of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const app = Fastify({
  logger,
  genReqId(req) {
    const headerId = req.headers["x-request-id"] ?? req.headers["x-requestid"];
    if (Array.isArray(headerId)) {
      return headerId[0];
    }
    return typeof headerId === "string" && headerId.length > 0 ? headerId : randomUUID();
  },
  requestIdHeader: "x-request-id",
  requestIdLogLabel: "reqId",
});

app.addHook("onRequest", (req, reply, done) => {
  const start = process.hrtime.bigint();
  (req as any).metricsStart = start;

  const parentCtx = extractContextFromHeaders(req.headers as Record<string, unknown>);
  const span = tracer.startSpan(`${req.method} ${req.url}`, undefined, parentCtx);
  const spanCtx = span.spanContext();
  const otelCtx = trace.setSpan(parentCtx, span);
  (req as any).otelSpan = span;
  (req as any).otelCtx = otelCtx;
  context.bind(req.raw, otelCtx);
  context.bind(reply.raw, otelCtx);

  const enrichedLogger = req.log.child({ traceId: spanCtx.traceId, spanId: spanCtx.spanId });
  (req as any).log = enrichedLogger;
  (reply as any).log = enrichedLogger;

  done();
});

app.addHook("preHandler", (req, _reply, done) => {
  const ctx = (req as any).otelCtx;
  if (ctx) {
    context.with(ctx, done);
    return;
  }
  done();
});

app.addHook("onResponse", (req, reply, done) => {
  const span = (req as any).otelSpan;
  const ctx = (req as any).otelCtx ?? context.active();
  const route = req.routerPath ?? req.routeOptions?.url ?? req.url ?? "unknown";
  const labels = {
    method: req.method,
    route,
    status_code: String(reply.statusCode),
  } as const;

  httpRequestCounter.inc(labels);

  const start = (req as any).metricsStart as bigint | undefined;
  if (start) {
    const diff = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, diff);
    span?.setAttribute("http.server.duration", diff);
  }

  if (span) {
    span.setAttribute("http.method", req.method);
    span.setAttribute("http.route", route);
    span.setAttribute("http.status_code", reply.statusCode);
    span.setStatus({
      code: reply.statusCode >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
    });
    span.end();
  }

  const outboundHeaders = injectContextToHeaders(ctx);
  for (const [key, value] of Object.entries(outboundHeaders)) {
    reply.header(key, value);
  }

  done();
});

await app.register(cors, { origin: true });

// Quick sanity log so you can verify the DSN being used
app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

app.get("/metrics", async (_req, reply) => {
  reply.header("content-type", register.contentType);
  return reply.send(await register.metrics());
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

// Print all routes once ready (to verify POST exists)
app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
