import fp from "fastify-plugin";
import promClient from "prom-client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const requestStartKey = Symbol("requestStartTime");

let defaultMetricsRegistered = false;

const httpRequestCounter = (() => {
  const existing = promClient.register.getSingleMetric(
    "http_requests_total",
  ) as promClient.Counter<string> | undefined;
  if (existing) {
    return existing;
  }
  return new promClient.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
  });
})();

const httpRequestDuration = (() => {
  const existing = promClient.register.getSingleMetric(
    "http_request_duration_seconds",
  ) as promClient.Histogram<string> | undefined;
  if (existing) {
    return existing;
  }
  return new promClient.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [
      0.005,
      0.01,
      0.025,
      0.05,
      0.1,
      0.25,
      0.5,
      1,
      2.5,
      5,
      10,
    ],
  });
})();

function recordRequestMetrics(
  request: FastifyRequest,
  reply: FastifyReply,
  durationSeconds?: number,
) {
  const route = request.routeOptions?.url ?? request.routerPath ?? request.url;
  const labels = {
    method: request.method,
    route,
    status_code: String(reply.statusCode),
  };
  httpRequestCounter.inc(labels);
  if (typeof durationSeconds === "number") {
    httpRequestDuration.observe(labels, durationSeconds);
  }
}

const metricsPlugin = fp(async (app: FastifyInstance) => {
  if (!defaultMetricsRegistered) {
    promClient.collectDefaultMetrics();
    defaultMetricsRegistered = true;
  }

  app.addHook("onRequest", (request: FastifyRequest, _reply, done) => {
    (request as any)[requestStartKey] = process.hrtime.bigint();
    done();
  });

  app.addHook("onResponse", (request: FastifyRequest, reply, done) => {
    const start = (request as any)[requestStartKey] as bigint | undefined;
    let durationSeconds: number | undefined;
    if (typeof start === "bigint") {
      const diff = process.hrtime.bigint() - start;
      durationSeconds = Number(diff) / 1e9;
    }
    recordRequestMetrics(request, reply, durationSeconds);
    done();
  });

  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", promClient.register.contentType);
    return promClient.register.metrics();
  });
});

export default metricsPlugin;
