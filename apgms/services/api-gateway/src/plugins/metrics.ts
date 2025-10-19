import type { FastifyPluginAsync } from "fastify";
import {
  Counter,
  Histogram,
  collectDefaultMetrics,
  register,
} from "prom-client";

const DEFAULT_BUCKETS = [
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
];

const metricsPlugin: FastifyPluginAsync = async (app) => {
  if (!(globalThis as Record<string, unknown>).__promClientDefaultMetrics) {
    (globalThis as Record<string, unknown>).__promClientDefaultMetrics =
      collectDefaultMetrics({ register });
  }

  const httpRequestsTotal =
    register.getSingleMetric("http_requests_total") ??
    new Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests",
      labelNames: ["method", "route", "status_code"],
      registers: [register],
    });

  const httpRequestDurationSeconds =
    (register.getSingleMetric(
      "http_request_duration_seconds",
    ) as Histogram<string>) ??
    new Histogram({
      name: "http_request_duration_seconds",
      help: "Duration of HTTP requests in seconds",
      labelNames: ["method", "route", "status_code"],
      buckets: DEFAULT_BUCKETS,
      registers: [register],
    });

  app.addHook("onResponse", async (request, reply) => {
    const route =
      request.routeOptions?.url ??
      (request as { routerPath?: string }).routerPath ??
      request.url;
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    } as const;

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(
      labels,
      reply.getResponseTime() / 1000,
    );
  });

  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
  });
};

export default metricsPlugin;
