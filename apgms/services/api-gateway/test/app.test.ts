import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";

import { createApp } from "../src/app";
import type { CreateAppOptions } from "../src/app";
import type { FastifyServerOptions } from "fastify";

const TRACE_OUTPUT_PATH = path.resolve(process.cwd(), "artifacts/traces.json");

type LogEntry = {
  msg: string;
  route?: string;
  orgId?: string | null;
  status?: number;
  requestId?: string;
  latencyMs?: number;
};

type PrismaStub = {
  user: { findMany: () => Promise<unknown[]> };
  bankLine: {
    findMany: () => Promise<unknown[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
};

function createTestLogger(collected: LogEntry[]): FastifyServerOptions["logger"] {
  return {
    level: "info",
    stream: {
      write(msg: string) {
        const value = msg.toString().trim();
        if (!value) return;
        for (const line of value.split("\n")) {
          try {
            collected.push(JSON.parse(line));
          } catch {
            // ignore non-JSON lines
          }
        }
      },
    },
  } satisfies FastifyServerOptions["logger"];
}

function createPrismaStub(): PrismaStub {
  return {
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async ({ data }) => ({ id: "stub-line", ...data }),
    },
  };
}

test("logs request metadata in structured form", async () => {
  await fs.rm(TRACE_OUTPUT_PATH, { force: true });

  const logs: LogEntry[] = [];
  const logger = createTestLogger(logs);
  const prisma = createPrismaStub() as unknown as NonNullable<CreateAppOptions["prisma"]>;
  const app = await createApp({ logger, enableTracing: false, prisma });

  await app.inject({
    method: "GET",
    url: "/health",
    headers: { "x-org-id": "org-123" },
  });

  await app.close();

  const requestLog = logs.find((entry) => entry.msg === "request completed" && entry.route === "/health");

  assert.ok(requestLog, "expected request log entry to be present");
  assert.equal(requestLog.orgId, "org-123");
  assert.equal(requestLog.route, "/health");
  assert.equal(requestLog.status, 200);
  assert.equal(typeof requestLog.requestId, "string");
  assert.equal(typeof requestLog.latencyMs, "number");
});

test("emits otel traces to artifacts when enabled", async () => {
  await fs.rm(TRACE_OUTPUT_PATH, { force: true });

  const logs: LogEntry[] = [];
  const logger = createTestLogger(logs);
  const prisma = createPrismaStub() as unknown as NonNullable<CreateAppOptions["prisma"]>;
  const app = await createApp({ logger, enableTracing: true, prisma });

  await app.inject({ method: "GET", url: "/health" });

  await app.close();

  const contents = await fs.readFile(TRACE_OUTPUT_PATH, "utf8");
  const spans = JSON.parse(contents) as Array<Record<string, any>>;

  assert.ok(Array.isArray(spans));
  assert.ok(spans.length > 0, "expected at least one span to be exported");
  const hasHealthSpan = spans.some(
    (span) => span.attributes?.["http.target"] === "/health" || span.attributes?.["fastify.route"] === "/health",
  );
  assert.ok(hasHealthSpan, "expected a span for the /health route");
});
