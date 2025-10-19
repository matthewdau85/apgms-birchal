import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { buildApp } from "../src/app";
import { setupGracefulShutdown } from "../src/shutdown";

type PrismaMock = {
  $queryRaw: (...args: any[]) => Promise<unknown>;
  $disconnect: () => Promise<void>;
  user: { findMany: (...args: any[]) => Promise<unknown[]> };
  bankLine: {
    findMany: (...args: any[]) => Promise<unknown[]>;
    create: (...args: any[]) => Promise<unknown>;
  };
};

const createPrismaMock = (): PrismaMock => ({
  $queryRaw: async () => 1,
  $disconnect: async () => {},
  user: { findMany: async () => [] },
  bankLine: {
    findMany: async () => [],
    create: async () => ({}),
  },
});

class FakeProcess extends EventEmitter {
  exitCode: number | undefined;

  exit(code?: number) {
    this.exitCode = code ?? 0;
  }
}

test("readyz reflects database connectivity", async (t) => {
  const prisma = createPrismaMock();
  const app = await buildApp({ prisma });
  await app.ready();

  t.after(async () => {
    await app.close();
  });

  const failingMock = mock.method(prisma, "$queryRaw", () => {
    throw new Error("db down");
  });

  t.after(() => {
    failingMock.mock.restore();
  });

  let response = await app.inject({ method: "GET", url: "/readyz" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { status: "not_ready" });

  failingMock.mock.restore();

  const successMock = mock.method(prisma, "$queryRaw", async () => 1);
  t.after(() => {
    successMock.mock.restore();
  });

  response = await app.inject({ method: "GET", url: "/readyz" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ready" });

  successMock.mock.restore();
});

test("graceful shutdown closes Fastify and disconnects Prisma", async () => {
  const prisma = createPrismaMock();
  const app = await buildApp({ prisma });
  await app.ready();

  let fastifyClosed = false;
  let prismaDisconnected = false;

  const originalClose = app.close.bind(app);
  const closeMock = mock.method(app, "close", async () => {
    fastifyClosed = true;
    await originalClose();
  });

  const originalDisconnect = prisma.$disconnect.bind(prisma);
  const disconnectMock = mock.method(prisma, "$disconnect", async () => {
    prismaDisconnected = true;
    await originalDisconnect();
  });

  const fakeProcess = new FakeProcess();
  let exitCode: number | undefined;
  fakeProcess.exit = (code?: number) => {
    assert.ok(fastifyClosed, "Fastify should be closed before exit");
    assert.ok(prismaDisconnected, "Prisma should be disconnected before exit");
    exitCode = code ?? 0;
  };

  const cleanup = setupGracefulShutdown(app, fakeProcess as unknown as NodeJS.Process, prisma);

  fakeProcess.emit("SIGTERM");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(closeMock.mock.callCount(), 1);
  assert.equal(disconnectMock.mock.callCount(), 1);
  assert.equal(exitCode, 0);

  cleanup();
  assert.equal(fakeProcess.listenerCount("SIGTERM"), 0);
  assert.equal(fakeProcess.listenerCount("SIGINT"), 0);

  await app.close();

  closeMock.mock.restore();
  disconnectMock.mock.restore();
});
