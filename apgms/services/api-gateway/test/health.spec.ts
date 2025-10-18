import assert from "node:assert/strict";
import { test } from "node:test";
process.env.NODE_ENV = "test";

const { createApp, setupSignalHandlers } = await import("../src/index");
const { prisma } = await import("../../../shared/src/db");

type PrismaDisconnect = NonNullable<Parameters<typeof setupSignalHandlers>[1]>;

test("GET /healthz returns service health", { concurrency: false }, async (t) => {
  const app = await createApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: "GET", url: "/healthz" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true, service: "api-gateway" });
});

test(
  "GET /readyz reports ready when database is reachable",
  { concurrency: false },
  async (t) => {
    const app = await createApp();
    t.after(async () => {
      await app.close();
    });

    const originalQueryRaw = prisma.$queryRaw;
    prisma.$queryRaw = (async () => []) as typeof prisma.$queryRaw;
    t.after(() => {
      prisma.$queryRaw = originalQueryRaw;
    });

    const response = await app.inject({ method: "GET", url: "/readyz" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ready: true });
  },
);

test(
  "GET /readyz returns 503 when database is unreachable",
  { concurrency: false },
  async (t) => {
    const app = await createApp();
    t.after(async () => {
      await app.close();
    });

    const originalQueryRaw = prisma.$queryRaw;
    prisma.$queryRaw = (async () => {
      throw new Error("db down");
    }) as typeof prisma.$queryRaw;
    t.after(() => {
      prisma.$queryRaw = originalQueryRaw;
    });

    const response = await app.inject({ method: "GET", url: "/readyz" });

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { ready: false, reason: "db_unreachable" });
  },
);

test("SIGTERM triggers graceful shutdown", { concurrency: false }, async (t) => {
  const app = await createApp();

  const events: string[] = [];
  const originalClose = app.close.bind(app);
  t.after(async () => {
    app.close = originalClose;
    try {
      await originalClose();
    } catch {
      // ignore if already closed
    }
  });
  app.close = (async () => {
    events.push("close");
    await originalClose();
  }) as typeof app.close;

  let resolveShutdown!: () => void;
  const shutdownComplete = new Promise<void>((resolve) => {
    resolveShutdown = resolve;
  });

  const prismaDisconnectMock = {
    $disconnect: async () => {
      events.push("disconnect");
      resolveShutdown();
    },
  } as PrismaDisconnect;

  const cleanup = setupSignalHandlers(app, prismaDisconnectMock);
  t.after(cleanup);

  process.emit("SIGTERM");

  await shutdownComplete;

  assert.deepEqual(events, ["close", "disconnect"]);
});
