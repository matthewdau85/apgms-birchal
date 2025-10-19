import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import promClient from "prom-client";
import metricsPlugin from "../src/plugins/metrics";
import healthRoutes from "../src/routes/ops/health";

class PrismaMock {
  constructor(private readonly shouldFail = false) {}

  async $queryRawUnsafe(_query: string) {
    if (this.shouldFail) {
      throw new Error("db down");
    }
    return [{ ok: 1 }];
  }
}

type RedisMockOptions = { shouldFail?: boolean };

function createRedisMock(options: RedisMockOptions = {}) {
  return {
    async ping() {
      if (options.shouldFail) {
        throw new Error("redis down");
      }
      return "PONG";
    },
  };
}

async function buildTestApp(options: {
  redis?: ReturnType<typeof createRedisMock>;
  prisma?: PrismaMock;
} = {}) {
  const app = Fastify({ logger: false });
  if (!app.hasDecorator("prisma")) {
    app.decorate("prisma", options.prisma ?? new PrismaMock());
  }
  if (options.redis) {
    app.decorate("redis", options.redis);
  }
  await app.register(metricsPlugin);
  await app.register(healthRoutes);
  await app.ready();
  return app;
}

beforeEach(() => {
  promClient.register.resetMetrics();
});

test("GET /health returns service ok", async () => {
  const app = await buildTestApp();
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.ok, true);
  await app.close();
});

test("GET /ready returns 503 when redis is down", async () => {
  const app = await buildTestApp({
    redis: createRedisMock({ shouldFail: true }),
    prisma: new PrismaMock(false),
  });
  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 503);
  const payload = response.json();
  assert.equal(payload.ok, false);
  assert.ok(Array.isArray(payload.failures));
  assert.ok(payload.failures.includes("redis"));
  await app.close();
});

test("GET /ready returns 200 when dependencies are healthy", async () => {
  const app = await buildTestApp({
    redis: createRedisMock(),
    prisma: new PrismaMock(false),
  });
  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.ok, true);
  await app.close();
});

test("GET /metrics exposes Prometheus format", async () => {
  const app = await buildTestApp();
  const response = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], promClient.register.contentType);
  const body = response.body;
  assert.match(body, /process_cpu_user_seconds_total/);
  await app.close();
});
