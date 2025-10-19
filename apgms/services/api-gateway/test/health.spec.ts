import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp, type AppDependencies, type DatabaseClient } from "../src/app";
import { createShutdownHandler } from "../src/shutdown";

function createPrismaStub(overrides: Partial<DatabaseClient> = {}): DatabaseClient {
  const base: DatabaseClient = {
    $queryRaw: async () => ({ ok: true }) as any,
    $disconnect: async () => {},
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async ({ data }) => ({ id: "bank_line_stub", ...data }),
    },
  };

  const user = overrides.user
    ? { ...base.user, ...overrides.user }
    : base.user;
  const bankLine = overrides.bankLine
    ? { ...base.bankLine, ...overrides.bankLine }
    : base.bankLine;

  return {
    ...base,
    ...overrides,
    user,
    bankLine,
  };
}

describe("health and readiness endpoints", () => {
  test("/healthz always reports ok", async () => {
    const prisma = createPrismaStub();
    const app = buildApp({ logger: false }, { prisma });

    const response = await app.inject({ method: "GET", url: "/healthz" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok", service: "api-gateway" });

    await app.close();
    await prisma.$disconnect();
  });

  test("/readyz returns 503 when the database ping fails", async () => {
    const error = new Error("db offline");
    let calls = 0;
    const prisma = createPrismaStub({
      async $queryRaw() {
        calls += 1;
        throw error;
      },
    });
    const app = buildApp({ logger: false }, { prisma });

    const response = await app.inject({ method: "GET", url: "/readyz" });

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { status: "error", reason: "database_unreachable" });
    assert.equal(calls, 1);

    await app.close();
    await prisma.$disconnect();
  });
});

describe("graceful shutdown", () => {
  test("handler drains fastify and disconnects prisma only once", async () => {
    let closeCalls = 0;
    const fakeApp = {
      async close() {
        closeCalls += 1;
      },
      log: {
        info: () => {},
        error: () => {},
      },
    } as unknown as FastifyInstance;

    let disconnectCalls = 0;
    const prisma = createPrismaStub({
      async $disconnect() {
        disconnectCalls += 1;
      },
    });

    let exitCalls = 0;
    let lastExitCode: number | undefined;
    const exit = (code?: number) => {
      exitCalls += 1;
      lastExitCode = code;
    };

    const deps: AppDependencies = { prisma };
    const handler = createShutdownHandler(fakeApp, deps, exit);

    await handler("SIGTERM");

    assert.equal(closeCalls, 1);
    assert.equal(disconnectCalls, 1);
    assert.equal(exitCalls, 1);
    assert.equal(lastExitCode, 0);

    await handler("SIGINT");

    assert.equal(closeCalls, 1, "close should not be called again");
    assert.equal(disconnectCalls, 1, "disconnect should not be called again");
    assert.equal(exitCalls, 1, "exit should not run again");
  });
});
