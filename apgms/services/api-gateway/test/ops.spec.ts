import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

import metricsPlugin from "../src/plugins/metrics";
import healthRoutes from "../src/routes/ops/health";

type RedisStub = {
  ping: () => Promise<string>;
};

async function buildApp(options: { redis?: RedisStub } = {}) {
  const app = Fastify();
  if (options.redis) {
    (app as { redis?: RedisStub }).redis = options.redis;
  }

  await app.register(metricsPlugin);
  await app.register(healthRoutes);

  return app;
}

test("GET /health returns ok", async (t) => {
  const app = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
});

test("GET /metrics exposes Prometheus metrics", async (t) => {
  const app = await buildApp({
    redis: { ping: async () => "PONG" },
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] ?? "", /text\/plain/);
  assert.ok(response.body.includes("# HELP"));
});

test("GET /ready fails when Redis is unavailable", async (t) => {
  const app = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { ready: false });
});

test("GET /ready succeeds when Redis responds", async (t) => {
  const redis: RedisStub = {
    ping: async () => "PONG",
  };
  const app = await buildApp({ redis });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ready: true });
});
