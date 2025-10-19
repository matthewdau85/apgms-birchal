import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";

import Fastify from "fastify";

import { registerHealthRoutes } from "../src/routes/health";
import { setupGracefulShutdown } from "../src/shutdown";

test("/readyz returns 200 when the database responds", async () => {
  const app = Fastify();
  registerHealthRoutes(app, {
    $queryRaw: async () => 1,
  });

  const response = await app.inject({ method: "GET", url: "/readyz" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ready: true });
});

test("/readyz returns 503 when the database is unavailable", async () => {
  const app = Fastify({ logger: false });
  registerHealthRoutes(app, {
    $queryRaw: async () => {
      throw new Error("db down");
    },
  });

  const response = await app.inject({ method: "GET", url: "/readyz" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { ready: false, reason: "db" });
});

test("setupGracefulShutdown closes the server and disconnects Prisma on SIGTERM", async () => {
  let closed = false;
  let disconnected = false;

  const fakeApp = {
    close: async () => {
      closed = true;
    },
    log: {
      info: () => {},
      error: () => {},
    },
  } as unknown as ReturnType<typeof Fastify>;

  const fakePrisma = {
    $disconnect: async () => {
      disconnected = true;
    },
  } as any;

  const cleanup = setupGracefulShutdown(fakeApp, fakePrisma, { exit: false });
  process.emit("SIGTERM");

  await setImmediate();

  assert.equal(closed, true);
  assert.equal(disconnected, true);

  cleanup();
});
