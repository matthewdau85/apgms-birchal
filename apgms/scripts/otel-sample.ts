import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, "evidence");
const otelSummaryFile = path.join(evidenceDir, "otel-summary.json");

interface RequestResult {
  method: string;
  path: string;
  status: number;
  ok: boolean;
}

async function waitForUrl(url: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) {
        return;
      }
    } catch (err) {
      // ignore until timeout
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startApi(): ChildProcess {
  return spawn("pnpm", ["--filter", "@apgms/api-gateway", "exec", "tsx", "src/index.ts"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: "3310",
      USE_PRISMA_MOCK: "true",
      DATABASE_URL: "mock://prisma",
      SHADOW_DATABASE_URL: "mock://prisma",
    },
    stdio: "inherit",
  });
}

async function performTraffic(baseUrl: string): Promise<RequestResult[]> {
  const requests: Array<Promise<RequestResult>> = [];

  const makeRequest = async (method: string, route: string, body?: unknown): Promise<RequestResult> => {
    const url = `${baseUrl}${route}`;
    const res = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { method, path: route, status: res.status, ok: res.ok };
  };

  requests.push(makeRequest("GET", "/health"));
  requests.push(makeRequest("GET", "/users"));
  requests.push(makeRequest("GET", "/bank-lines"));
  requests.push(
    makeRequest("POST", "/bank-lines", {
      orgId: "demo-org",
      date: new Date().toISOString(),
      amount: 199.99,
      payee: "Telemetry",
      desc: "happy path",
    }),
  );
  requests.push(makeRequest("POST", "/bank-lines", { bad: "payload" }));
  requests.push(makeRequest("POST", "/bank-lines", { bad: "payload" }));
  requests.push(makeRequest("POST", "/bank-lines", { bad: "payload" }));

  return Promise.all(requests);
}

async function writeSummary(results: RequestResult[]) {
  await fs.mkdir(evidenceDir, { recursive: true });
  const totalRequests = results.length;
  const errorCount = results.filter((r) => !r.ok).length;
  const summary = {
    generatedAt: new Date().toISOString(),
    totalRequests,
    errorCount,
    errorRatio: totalRequests === 0 ? 0 : errorCount / totalRequests,
    requests: results,
  };
  await fs.writeFile(otelSummaryFile, JSON.stringify(summary, null, 2) + "\n", "utf8");
}

async function shutdownProcess(child: ChildProcess) {
  child.kill("SIGINT");
  await Promise.race([once(child, "exit"), delay(2000)]);
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  const apiProcess = startApi();
  const exitPromise = once(apiProcess, "exit").then(() => {
    throw new Error("API gateway exited before it became ready");
  });

  try {
    await Promise.race([waitForUrl("http://127.0.0.1:3310/health", 30000), exitPromise]);
    const results = await performTraffic("http://127.0.0.1:3310");
    await writeSummary(results);
  } finally {
    await shutdownProcess(apiProcess);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
