import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app";
import { createMetricsCollector } from "./metrics";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const metricsDir = process.env.METRICS_DIR
  ? path.resolve(process.env.METRICS_DIR)
  : path.resolve(__dirname, "../metrics");

const collector = createMetricsCollector({ outputDir: metricsDir });

const { app } = await buildApp({
  useMockDb: process.env.USE_MOCK_DB === "1",
  collector,
});

app.log.info(
  {
    DATABASE_URL: process.env.DATABASE_URL,
    USE_MOCK_DB: process.env.USE_MOCK_DB,
    METRICS_DIR: metricsDir,
  },
  "loaded env"
);

app.ready(() => {
  app.log.info(app.printRoutes());
});

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

const shutdown = async () => {
  app.log.info("shutting down, flushing metrics");
  await collector.flush();
  await app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  await collector.flush().catch(() => undefined);
  process.exit(1);
}
