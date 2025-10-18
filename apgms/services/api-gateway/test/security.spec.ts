import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import Fastify from "fastify";
import security from "../src/plugins/security";

const originalEnv = { ...process.env };

const resetEnv = () => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
};

const buildApp = async () => {
  const app = Fastify({ logger: false });
  await app.register(security);
  app.get("/ping", async () => ({ ok: true }));
  app.post("/echo", async (request) => request.body);
  await app.ready();
  return app;
};

beforeEach(() => {
  resetEnv();
});

test("CORS preflight from disallowed origin is blocked", async (t) => {
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://allowed.example";

  const app = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "OPTIONS",
    url: "/ping",
    headers: {
      origin: "https://evil.example",
      "access-control-request-method": "GET",
    },
  });

  assert.ok(response.statusCode >= 400);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
});

test("requests beyond the configured limit receive 429", async (t) => {
  process.env.RATE_LIMIT_RPM = "2";

  const app = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const first = await app.inject({ method: "GET", url: "/ping" });
  const second = await app.inject({ method: "GET", url: "/ping" });
  const third = await app.inject({ method: "GET", url: "/ping" });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 429);
  assert.deepEqual(JSON.parse(third.payload), { error: "rate_limit_exceeded" });
});

test("payloads larger than the configured limit receive 413", async (t) => {
  process.env.BODY_LIMIT_BYTES = "10";

  const app = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "POST",
    url: "/echo",
    payload: "a".repeat(32),
    headers: { "content-type": "text/plain" },
  });

  assert.equal(response.statusCode, 413);
  assert.deepEqual(JSON.parse(response.payload), { error: "payload_too_large" });
});
