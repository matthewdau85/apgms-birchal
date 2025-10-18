import { type FastifyPluginAsync } from "fastify";

const serializeLabels = (labels: Record<string, string>) =>
  Object.entries(labels)
    .map(([key, value]) => `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");

export const metricsPlugin: FastifyPluginAsync = async (app) => {
  const requestCounts = new Map<string, number>();
  const durationStats = new Map<string, { count: number; total: number }>();

  app.addHook("onRequest", async (request) => {
    request.metricsStart = process.hrtime.bigint();
  });

  app.addHook("onResponse", async (request, reply) => {
    const route = request.routerPath ?? request.url;
    const method = request.method;
    const status = reply.statusCode;
    const countKey = JSON.stringify({ method, route, status });
    requestCounts.set(countKey, (requestCounts.get(countKey) ?? 0) + 1);

    if (request.metricsStart) {
      const durationSeconds = Number(process.hrtime.bigint() - request.metricsStart) / 1e9;
      const durationKey = JSON.stringify({ method, route });
      const stats = durationStats.get(durationKey) ?? { count: 0, total: 0 };
      stats.count += 1;
      stats.total += durationSeconds;
      durationStats.set(durationKey, stats);
    }
  });

  app.get(
    "/metrics",
    {
      config: { public: true },
      schema: {
        response: {
          200: { type: "string" },
        },
      },
    },
    async (_req, reply) => {
      let body = "# HELP api_gateway_requests_total Total number of requests handled by the API gateway\n";
      body += "# TYPE api_gateway_requests_total counter\n";
      for (const [key, value] of requestCounts.entries()) {
        const labels = JSON.parse(key) as { method: string; route: string; status: number };
        body += `api_gateway_requests_total{${serializeLabels({
          method: labels.method,
          route: labels.route,
          status: String(labels.status),
        })}} ${value}\n`;
      }

      body += "# HELP api_gateway_request_duration_seconds_sum Total duration of handled requests\n";
      body += "# TYPE api_gateway_request_duration_seconds_sum gauge\n";
      body += "# HELP api_gateway_request_duration_seconds_count Count of handled requests with duration samples\n";
      body += "# TYPE api_gateway_request_duration_seconds_count gauge\n";
      for (const [key, stats] of durationStats.entries()) {
        const labels = JSON.parse(key) as { method: string; route: string };
        const labelString = serializeLabels({ method: labels.method, route: labels.route });
        body += `api_gateway_request_duration_seconds_sum{${labelString}} ${stats.total}\n`;
        body += `api_gateway_request_duration_seconds_count{${labelString}} ${stats.count}\n`;
      }

      reply.header("Content-Type", "text/plain; version=0.0.4");
      return body;
    },
  );
};

declare module "fastify" {
  interface FastifyRequest {
    metricsStart?: bigint;
  }
}
