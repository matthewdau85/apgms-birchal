import { createLogger } from "@apgms/shared/src/observability/logger";
import {
  createMetricsRegistry,
  startMetricsServer,
} from "@apgms/shared/src/observability/metrics";

const serviceName = process.env.SERVICE_NAME ?? "worker";
const logger = createLogger({ serviceName });
const metricsRegistry = createMetricsRegistry({ serviceName });

const processedJobs = metricsRegistry.counter({
  name: "worker_jobs_processed_total",
  help: "Number of jobs processed by the worker",
  labelNames: ["queue"],
});

const metricsPort = Number(process.env.METRICS_PORT ?? 9100);
startMetricsServer({ register: metricsRegistry, port: metricsPort, logger });

logger.info({ serviceName }, "worker booting");

const queueName = process.env.WORKER_QUEUE ?? "default";

const simulateWork = async () => {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  processedJobs.inc({ queue: queueName });
  logger.info({ queue: queueName }, "processed synthetic job");
  setImmediate(simulateWork);
};

simulateWork();
