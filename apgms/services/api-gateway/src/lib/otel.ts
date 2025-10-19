import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";

type PendingSpan = {
  name: string;
  method: string;
  route: string;
  start: number;
  orgId?: string;
  statusCode?: number;
  durationMs?: number;
};

const traces: PendingSpan[] = [];
let otelEnabled = false;
let flushScheduled = false;

async function flushTraces() {
  const outputPath = path.resolve(process.cwd(), "artifacts/otel/trace.json");
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, `${JSON.stringify(traces, null, 2)}\n`);
}

export async function registerOtel(app: FastifyInstance) {
  if (process.env.OTEL_ENABLED !== "true") {
    return { enabled: false } as const;
  }

  otelEnabled = true;

  if (!flushScheduled) {
    flushScheduled = true;
    process.once("beforeExit", () => {
      flushTraces().catch((err) => {
        console.error("failed to write otel trace", err);
      });
    });
  }

  app.addHook("onRequest", async (req) => {
    if (!otelEnabled) return;
    (req as any).__otel = {
      name: `HTTP ${req.method}`,
      method: req.method,
      route: req.routerPath ?? req.url,
      start: Date.now(),
    } satisfies PendingSpan;
  });

  app.addHook("onResponse", async (req, reply) => {
    if (!otelEnabled) return;
    const span = (req as any).__otel as PendingSpan | undefined;
    if (span) {
      span.statusCode = reply.statusCode;
      const headerOrg = req.headers["x-org-id"];
      if (typeof headerOrg === "string") {
        span.orgId = headerOrg;
      }
      span.durationMs = Date.now() - span.start;
      traces.push({ ...span, route: req.routerPath ?? req.url });
    }
  });

  return { enabled: true } as const;
}
