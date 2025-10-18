import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "../src/app";
import { createMetricsCollector } from "../src/metrics";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.resolve(__dirname, "../metrics/mock-run");
const collector = createMetricsCollector({ outputDir });

const { app } = await buildApp({ useMockDb: true, collector });

async function hit(method: "GET" | "POST", url: string, payload?: any) {
  const response = await app.inject({ method, url, payload });
  if (response.statusCode >= 400) {
    throw new Error(`Request failed: ${method} ${url} -> ${response.statusCode}`);
  }
}

async function main() {
  const tasks = [
    { method: "GET" as const, url: "/health", count: 220 },
    { method: "GET" as const, url: "/bank-lines?take=20", count: 140 },
    { method: "GET" as const, url: "/users", count: 90 },
  ];

  for (const task of tasks) {
    for (let i = 0; i < task.count; i += 1) {
      await hit(task.method, task.url);
    }
  }

  const postPayloads = [
    {
      orgId: "org_birchal",
      date: "2024-07-21",
      amount: 320.55,
      payee: "Insurance",
      desc: "Policy renewal",
    },
    {
      orgId: "org_lumen",
      date: "2024-07-20",
      amount: 870.0,
      payee: "Cloud Vendor",
      desc: "Reserved capacity",
    },
    {
      orgId: "org_acme",
      date: "2024-07-19",
      amount: 1450.33,
      payee: "Logistics",
      desc: "Fleet upgrade",
    },
  ];

  for (let i = 0; i < 60; i += 1) {
    const payload = postPayloads[i % postPayloads.length];
    await hit("POST", "/bank-lines", payload);
  }

  const summary = await collector.flush();
  await app.close();
  console.log(`Traffic simulation complete. Summary written to ${outputDir}`);
  console.log(JSON.stringify(summary, null, 2));
}

await main();
