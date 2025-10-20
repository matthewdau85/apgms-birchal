const METRICS_CONTENT_TYPE = "text/plain; version=0.0.4";

const createMetricsState = () => ({
  startedAt: process.hrtime.bigint(),
  totalRequests: 0,
  totalErrors: 0,
});

const formatSeconds = (nsBigInt) => {
  const seconds = Number(nsBigInt) / 1e9;
  return seconds.toFixed(3);
};

const renderMetrics = (state) => {
  const uptimeNs = process.hrtime.bigint() - state.startedAt;
  const uptimeSeconds = formatSeconds(uptimeNs);
  return [
    "# HELP process_uptime_seconds Process uptime in seconds.",
    "# TYPE process_uptime_seconds gauge",
    `process_uptime_seconds ${uptimeSeconds}`,
    "# HELP http_requests_total Total number of HTTP requests handled by the service.",
    "# TYPE http_requests_total counter",
    `http_requests_total ${state.totalRequests}`,
    "# HELP http_requests_error_total Total number of HTTP 5xx responses handled by the service.",
    "# TYPE http_requests_error_total counter",
    `http_requests_error_total ${state.totalErrors}`,
  ].join("\n");
};

export default async function metricsPlugin(fastify, opts = {}) {
  const endpoint = typeof opts.endpoint === "string" ? opts.endpoint : "/metrics";
  const state = createMetricsState();

  fastify.addHook("onResponse", (_req, reply, done) => {
    state.totalRequests += 1;
    if (reply.statusCode >= 500) {
      state.totalErrors += 1;
    }
    done();
  });

  fastify.get(endpoint, async (_req, reply) => {
    reply.header("content-type", METRICS_CONTENT_TYPE);
    const body = `${renderMetrics(state)}\n`;
    return body;
  });
}
