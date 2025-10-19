import { spawn } from "node:child_process";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore while waiting
    }
    await delay(250);
  }
  throw new Error(`Server did not become ready at ${url}`);
}

async function sendRequests(baseUrl: string): Promise<{ requestCount: number; errorCount: number; durationMinutes: number }> {
  const total = 20;
  let requestCount = 0;
  let errorCount = 0;
  const start = process.hrtime.bigint();

  for (let i = 0; i < total; i++) {
    const target = i % 3 === 0 ? "/users" : "/bank-lines";
    const url = `${baseUrl}${target}`;
    try {
      let response;
      if (target === "/bank-lines" && i % 2 === 1) {
        response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
      } else {
        response = await fetch(url);
      }
      requestCount += 1;
      if (!response.ok) {
        errorCount += 1;
      }
    } catch {
      requestCount += 1;
      errorCount += 1;
    }
  }

  const end = process.hrtime.bigint();
  const durationMinutes = Number(end - start) / 60000000000;
  return { requestCount, errorCount, durationMinutes };
}

async function waitForFile(filePath: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fs.access(filePath);
      return;
    } catch {
      await delay(200);
    }
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

async function main(): Promise<void> {
  const server = spawn("pnpm", ["--filter", "@apgms/api-gateway", "dev"], {
    cwd: repoRoot,
    env: { ...process.env, OTEL_ENABLED: "true" },
    stdio: "inherit",
  });

  try {
    await waitForServer("http://127.0.0.1:3000/health");
    const { requestCount, errorCount, durationMinutes } = await sendRequests("http://127.0.0.1:3000");

    const errorRatio = requestCount === 0 ? 0 : errorCount / requestCount;
    const errorsPerMinute = durationMinutes === 0 ? (errorCount > 0 ? Infinity : 0) : errorCount / durationMinutes;
    const summary = {
      request_count: requestCount,
      error_count: errorCount,
      error_ratio: Number(errorRatio.toFixed(4)),
      errors_per_minute: Number(errorsPerMinute.toFixed(4)),
    };

    const evidenceDir = resolve(repoRoot, "evidence");
    await fs.mkdir(evidenceDir, { recursive: true });
    await fs.writeFile(resolve(evidenceDir, "otel-summary.json"), JSON.stringify(summary, null, 2));
  } finally {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
    if (server.exitCode === null && server.signalCode === null) {
      await once(server, "exit").catch(() => undefined);
    }
    const otelRunPath = resolve(repoRoot, "evidence/otel-run.json");
    await waitForFile(otelRunPath, 5000).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
