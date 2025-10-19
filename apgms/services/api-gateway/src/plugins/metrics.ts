import type { FastifyPluginAsync } from "fastify";
import { Histogram, Registry, collectDefaultMetrics } from "prom-client";

const REQUEST_START = Symbol("requestStart");

const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  const register = new Registry();
  collectDefaultMetrics({ register });

  const httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register],
  });

  fastify.addHook("onRequest", (request, _reply, done) => {
    (request as any)[REQUEST_START] = process.hrtime.bigint();
    done();
  });

  fastify.addHook("onResponse", (request, reply, done) => {
    const start = (request as any)[REQUEST_START] as bigint | undefined;
    if (start) {
      const durationNs = Number(process.hrtime.bigint() - start);
      const durationSeconds = durationNs / 1e9;
      const route = request.routeOptions?.url ?? request.raw.url ?? "unknown";
      httpRequestDuration
        .labels(request.method, route, reply.statusCode.toString())
        .observe(durationSeconds);
    }
    done();
  });

  fastify.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
  });
};

export default metricsPlugin;
