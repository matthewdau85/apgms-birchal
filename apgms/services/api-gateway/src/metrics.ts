import { createCounter, createHistogram, metricsRegistry } from "@apgms/shared";

export const httpRequestDuration = createHistogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests handled by the API gateway",
  labelNames: ["route", "method", "status_code"],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

export const httpRequestErrors = createCounter({
  name: "http_request_errors_total",
  help: "Count of requests that produced error responses",
  labelNames: ["route", "method", "status_code", "error_name"],
});

export { metricsRegistry };
