import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";

import { prisma } from "../../../shared/src/db";
import { registerSystemRoutes } from "./routes/system";

type LabelSet = {
  method: string;
  route: string;
  status_code: string;
};

type HistogramEntry = {
  labels: LabelSet;
  sum: number;
  count: number;
  buckets: number[];
};

type CounterEntry = {
  labels: LabelSet;
  value: number;
};

const histogramBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];
const requestCounters = new Map<string, CounterEntry>();
const requestHistograms = new Map<string, HistogramEntry>();

function labelsKey(labels: LabelSet) {
  return `${labels.method}|${labels.route}|${labels.status_code}`;
}

function formatLabels(labels: Record<string, string | number>) {
  const entries = Object.entries(labels).map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`);
  return entries.length ? `{${entries.join(",")}}` : "";
}

function observeCounter(labels: LabelSet) {
  const key = labelsKey(labels);
  const entry = requestCounters.get(key);
  if (entry) {
    entry.value += 1;
  } else {
    requestCounters.set(key, { labels, value: 1 });
  }
}

function observeHistogram(labels: LabelSet, value: number) {
  const key = labelsKey(labels);
  let entry = requestHistograms.get(key);
  if (!entry) {
    entry = { labels, sum: 0, count: 0, buckets: new Array(histogramBuckets.length + 1).fill(0) };
    requestHistograms.set(key, entry);
  }

  entry.count += 1;
  entry.sum += value;

  let bucketRecorded = false;
  for (let i = 0; i < histogramBuckets.length; i += 1) {
    if (value <= histogramBuckets[i]) {
      entry.buckets[i] += 1;
      bucketRecorded = true;
      break;
    }
  }
  // +Inf bucket (last entry)
  entry.buckets[histogramBuckets.length] += 1;
  if (!bucketRecorded) {
    // nothing else to do, +Inf already incremented
  }
}

type SpanRecord = {
  traceId: string;
  spanId: string;
  name: string;
  started: bigint;
  attributes: Record<string, unknown>;
  status?: { code: "OK" | "ERROR"; message?: string };
};

const requestSpanKey = Symbol("requestSpan");
const requestTimingKey = Symbol("requestTiming");

const logDestination = process.env.LOG_DESTINATION;
const loggerConfig = {
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "api-gateway" },
  transport: {
    target: "pino/file",
    options: {
      destination:
        logDestination && logDestination !== "stdout"
          ? path.resolve(logDestination)
          : 1,
    },
  },
};

const app = Fastify({ logger: loggerConfig });

await app.register(cors, { origin: true });

function startSpan(name: string, attributes: Record<string, unknown>): SpanRecord {
  return {
    traceId: randomUUID().replace(/-/g, ""),
    spanId: randomUUID().replace(/-/g, "").slice(0, 16),
    name,
    started: process.hrtime.bigint(),
    attributes,
  };
}

app.addHook("onRequest", async (request) => {
  const route = request.routeOptions?.url ?? request.url;
  const span = startSpan("http.request", {
    "http.method": request.method,
    "http.route": route,
    "http.target": request.url,
  });
  (request as any)[requestSpanKey] = span;
  (request as any)[requestTimingKey] = process.hrtime.bigint();
  request.log.info({ route, traceId: span.traceId, spanId: span.spanId }, "request received");
});

app.addHook("onResponse", async (request, reply) => {
  const route = request.routeOptions?.url ?? request.url;
  const statusCode = reply.statusCode.toString();
  const labels: LabelSet = { method: request.method, route, status_code: statusCode };
  observeCounter(labels);

  const startedAt = (request as any)[requestTimingKey] as bigint | undefined;
  let durationSeconds: number | undefined;
  if (startedAt) {
    durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    observeHistogram(labels, durationSeconds);
  }

  const span = (request as any)[requestSpanKey] as SpanRecord | undefined;
  if (span) {
    span.attributes["http.status_code"] = reply.statusCode;
    span.status = { code: "OK" };
  }

  request.log.info(
    {
      route,
      statusCode,
      durationSeconds,
      traceId: span?.traceId,
      spanId: span?.spanId,
    },
    "request completed",
  );
});

app.addHook("onError", async (request, _reply, error) => {
  const span = (request as any)[requestSpanKey] as SpanRecord | undefined;
  if (span) {
    span.status = { code: "ERROR", message: error.message };
  }
  request.log.error({ err: error, traceId: span?.traceId, spanId: span?.spanId }, "request failed");
});

app.get("/metrics", async (_request, reply) => {
  const lines: string[] = [];
  lines.push("# HELP http_requests_total Total count of HTTP requests");
  lines.push("# TYPE http_requests_total counter");
  for (const { labels, value } of requestCounters.values()) {
    lines.push(`http_requests_total${formatLabels(labels)} ${value}`);
  }

  lines.push("# HELP http_request_duration_seconds Histogram of HTTP request durations in seconds");
  lines.push("# TYPE http_request_duration_seconds histogram");
  for (const { labels, buckets, count, sum } of requestHistograms.values()) {
    let cumulative = 0;
    for (let i = 0; i < histogramBuckets.length; i += 1) {
      cumulative += buckets[i];
      const leLabel = { ...labels, le: histogramBuckets[i] };
      lines.push(`http_request_duration_seconds_bucket${formatLabels(leLabel)} ${cumulative}`);
    }
    const infiniteLabels = { ...labels, le: "+Inf" };
    lines.push(`http_request_duration_seconds_bucket${formatLabels(infiniteLabels)} ${count}`);
    lines.push(`http_request_duration_seconds_sum${formatLabels(labels)} ${sum}`);
    lines.push(`http_request_duration_seconds_count${formatLabels(labels)} ${count}`);
  }

  reply.header("Content-Type", "text/plain; version=0.0.4");
  return reply.send(lines.join("\n") + "\n");
});

app.log.info({ DATABASE_URL: process.env.DATABASE_URL }, "loaded env");

registerSystemRoutes(app, { prisma, redisUrl: process.env.REDIS_URL });

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
    req.log.error(e);
    return rep.code(400).send({ error: "bad_request" });
  }
});

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
