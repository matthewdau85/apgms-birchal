import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import Fastify from "fastify";
import { mock, test } from "node:test";

process.env.MOCK_PRISMA = "1";
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/apgms";
process.env.SHADOW_DATABASE_URL ??= process.env.DATABASE_URL;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

let prismaPromise: Promise<any> | undefined;
const getPrisma = () => {
  prismaPromise ??= import(path.resolve(projectRoot, "shared/src/db.ts")).then((mod) => mod.prisma);
  return prismaPromise;
};

let healthRoutesPromise: Promise<any> | undefined;
const getHealthRoutes = () => {
  healthRoutesPromise ??= import(path.resolve(projectRoot, "services/api-gateway/src/routes/health.ts")).then((mod) => mod.default);
  return healthRoutesPromise;
};

let shutdownModulePromise: Promise<any> | undefined;
const getShutdownModule = () => {
  shutdownModulePromise ??= import(path.resolve(projectRoot, "services/api-gateway/src/shutdown.ts"));
  return shutdownModulePromise;
};

const createApp = async () => {
  const app = Fastify();
  await app.register(await getHealthRoutes());
  return app;
};

test("/readyz responds 200 when database is reachable", async (t) => {
  const [app, prisma] = await Promise.all([createApp(), getPrisma()]);
  t.after(async () => {
    await app.close();
  });

  const readyMock = mock.method(prisma, "$queryRaw", async () => [{ ok: 1 }]);
  t.after(() => readyMock.mock.restore());

  const response = await app.inject({ method: "GET", url: "/readyz" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ready: true });
});

test("/readyz responds 503 when database is unreachable", async (t) => {
  const [app, prisma] = await Promise.all([createApp(), getPrisma()]);
  t.after(async () => {
    await app.close();
  });

  const errorMock = mock.method(prisma, "$queryRaw", async () => {
    throw new Error("connection failed");
  });
  t.after(() => errorMock.mock.restore());

  const response = await app.inject({ method: "GET", url: "/readyz" });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { ready: false, reason: "db_unreachable" });
});

test("process exits cleanly on SIGTERM", async (t) => {
  const { registerGracefulShutdown } = await getShutdownModule();
  const closeMock = mock.fn(async () => {
    await delay(10);
  });
  const disconnectMock = mock.fn(async () => {
    await delay(5);
  });

  const app = {
    close: closeMock,
    log: {
      info: mock.fn(() => {}),
      error: mock.fn(() => {}),
    },
  };

  const prisma = {
    $disconnect: disconnectMock,
  };

  let exitCode: number | undefined;
  let resolveExit: (() => void) | undefined;
  const exitPromise = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });

  const { dispose } = registerGracefulShutdown(app as any, prisma as any, {
    signals: ["SIGTERM"],
    exit: (code) => {
      exitCode = code;
      resolveExit?.();
    },
  });

  t.after(() => {
    dispose();
  });

  process.emit("SIGTERM");

  await exitPromise;

  assert.equal(closeMock.mock.callCount(), 1);
  assert.equal(disconnectMock.mock.callCount(), 1);
  assert.equal(exitCode, 0);
});
