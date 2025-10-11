import Fastify from "fastify";
import pino from "pino";
import client from "prom-client";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { context, trace, SpanStatusCode } from "@opentelemetry/api";
import {
  setupTracing,
  extractContextFromHeaders,
  injectContextToHeaders,
} from "../../shared/src";

const serviceName = "queue-worker";
const tracer = setupTracing(serviceName);

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: serviceName },
});

const register = new client.Registry();
register.setDefaultLabels({ service: serviceName });
client.collectDefaultMetrics({ register });

const jobProcessedCounter = new client.Counter({
  name: "queue_jobs_processed_total",
  help: "Total number of queue jobs processed",
  labelNames: ["queue", "status"],
  registers: [register],
});

const jobDurationHistogram = new client.Histogram({
  name: "queue_job_duration_seconds",
  help: "Duration of queue job processing in seconds",
  labelNames: ["queue", "status"],
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
  (req as any).metricsStart = process.hrtime.bigint();
  const parentCtx = extractContextFromHeaders(req.headers as Record<string, unknown>);
  const span = tracer.startSpan(`${req.method} ${req.url}`, undefined, parentCtx);
  const otelCtx = trace.setSpan(parentCtx, span);
  (req as any).otelSpan = span;
  (req as any).otelCtx = otelCtx;
  context.bind(req.raw, otelCtx);
  context.bind(reply.raw, otelCtx);
  const spanCtx = span.spanContext();
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

  const start = (req as any).metricsStart as bigint | undefined;
  if (start) {
    const diff = Number(process.hrtime.bigint() - start) / 1e9;
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

app.get("/health", async () => ({ ok: true, service: serviceName }));

app.get("/metrics", async (_req, reply) => {
  reply.header("content-type", register.contentType);
  return reply.send(await register.metrics());
});

async function processJob(queue: string): Promise<void> {
  const jobId = randomUUID();
  const span = tracer.startSpan(`job ${queue}`);
  const spanCtx = span.spanContext();
  const jobLogger = logger.child({ queue, reqId: jobId, traceId: spanCtx.traceId, spanId: spanCtx.spanId });
  const start = process.hrtime.bigint();
  try {
    await context.with(trace.setSpan(context.active(), span), async () => {
      jobLogger.info({ jobId, queue }, "processing job");
      await sleep(100);
    });
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    jobProcessedCounter.inc({ queue, status: "success" });
    jobDurationHistogram.observe({ queue, status: "success" }, duration);
    span.setStatus({ code: SpanStatusCode.OK });
    span.setAttribute("queue.name", queue);
    span.setAttribute("job.id", jobId);
    span.setAttribute("job.duration", duration);
    jobLogger.info({ jobId, queue, duration }, "job completed");
  } catch (err) {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    jobProcessedCounter.inc({ queue, status: "failed" });
    jobDurationHistogram.observe({ queue, status: "failed" }, duration);
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error)?.message });
    jobLogger.error({ err, jobId, queue, duration }, "job failed");
  } finally {
    span.end();
  }
}

let processing = false;
const queueName = process.env.WORKER_QUEUE ?? "reconciliation";

setInterval(() => {
  if (processing) {
    return;
  }
  processing = true;
  processJob(queueName).finally(() => {
    processing = false;
  });
}, Number(process.env.WORKER_POLL_INTERVAL_MS ?? 15000));

const port = Number(process.env.PORT ?? 4000);
const host = "0.0.0.0";

app.listen({ port, host }).then(() => {
  logger.info({ port, host }, "worker ready");
}).catch((err) => {
  logger.error(err, "failed to start worker");
  process.exit(1);
});
