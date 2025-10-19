import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const main = async () => {
  const port = Number(process.env.PORT ?? 3100);
  const traceFile = path.resolve(process.cwd(), "evidence/otel-trace.json");

  await fs.rm(traceFile, { force: true });
  process.env.PORT = String(port);
  process.env.OTEL_ENABLED = "true";
  process.env.OTEL_TRACE_FILE = traceFile;

  const { startServer } = await import("../services/api-gateway/src/index.ts");
  const server = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    await response.json();
    await delay(200);
  } finally {
    await server.close();
    const { forceFlushOtel, shutdownOtel } = await import("../services/api-gateway/src/observability/otel.ts");
    await forceFlushOtel();
    await shutdownOtel();
  }

  await fs.access(traceFile);
  const payload = await fs.readFile(traceFile, "utf8");
  console.log(payload);
};

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
