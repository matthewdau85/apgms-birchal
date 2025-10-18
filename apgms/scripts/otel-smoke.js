import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const port = process.env.OTEL_SMOKE_PORT ?? "3100";
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;

async function waitForHealth(url, child) {
  const timeoutAt = Date.now() + 30_000;
  while (Date.now() < timeoutAt) {
    if (child.exitCode !== null) {
      throw new Error(`API process exited with code ${child.exitCode} before becoming ready`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // ignore until ready
    }
    await delay(500);
  }
  throw new Error("Timed out waiting for API readiness");
}

async function runRequests() {
  const child = spawn("pnpm", ["--filter", "@apgms/api-gateway", "run", "dev"], {
    env: { ...process.env, PORT: port, PRISMA_DISABLE: "1" },
    stdio: "inherit",
    detached: true,
  });

  child.unref();

  let shuttingDown = false;

  const terminate = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    if (child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGINT");
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ESRCH")) {
          throw error;
        }
      }
      await once(child, "exit");
    }
  };

  try {
    await waitForHealth(`${baseUrl}/health`, child);

    const healthResponse = await fetch(`${baseUrl}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Expected health check to succeed, received status ${healthResponse.status}`);
    }
    await healthResponse.json();

    const protectedResponse = await fetch(`${baseUrl}/protected`);
    if (protectedResponse.status !== 401) {
      throw new Error(`Expected protected endpoint to return 401, received ${protectedResponse.status}`);
    }
    await protectedResponse.text();
  } finally {
    await terminate();
  }
}

async function ensureTraceFile() {
  const tracePath = path.resolve(process.cwd(), "reports", "otel-traces.ndjson");
  await fs.access(tracePath);
  const contents = await fs.readFile(tracePath, "utf8");
  if (!contents.trim()) {
    throw new Error("Trace file is empty");
  }
  console.log(`Trace file written to ${tracePath}`);
}

async function main() {
  await runRequests();
  await ensureTraceFile();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
