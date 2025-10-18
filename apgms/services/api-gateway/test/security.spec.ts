import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import securityPlugin from "../src/plugins/security.js";

type EnvOverrides = Record<string, string | undefined>;

type RouteRegistrar = (instance: FastifyInstance) => void | Promise<void>;

const previousEnv = new Map<string, string | undefined>();

const applyEnv = (overrides: EnvOverrides) => {
  previousEnv.clear();
  for (const [key, value] of Object.entries(overrides)) {
    previousEnv.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

afterEach(() => {
  for (const [key, value] of previousEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  previousEnv.clear();
});

const buildServer = async (registerRoutes: RouteRegistrar) => {
  const app = Fastify({ logger: false });
  await securityPlugin(app);
  await registerRoutes(app);
  await app.ready();
  return app;
};

test("preflight from disallowed origin is blocked", async () => {
  applyEnv({
    NODE_ENV: "production",
    ALLOWED_ORIGINS: "https://allowed.example.com",
  });

  const app = await buildServer(async (instance) => {
    instance.options("/preflight", async () => ({ ok: true }));
  });

  const response = await app.inject({
    method: "OPTIONS",
    url: "/preflight",
    headers: {
      origin: "https://evil.example.com",
      "access-control-request-method": "POST",
    },
  });

  assert.equal(response.statusCode, 403);
});

test("requests larger than the configured body limit are rejected", async () => {
  applyEnv({
    BODY_LIMIT_BYTES: String(512 * 1024),
  });

  const app = await buildServer(async (instance) => {
    instance.post("/echo", async (request) => request.body);
  });

  const payload = JSON.stringify({ data: "a".repeat(512 * 1024) });
  const response = await app.inject({
    method: "POST",
    url: "/echo",
    payload,
    headers: { "content-type": "application/json" },
  });

  assert.equal(response.statusCode, 413);
});

test("repeated requests over the limit yield 429", async () => {
  applyEnv({
    RATE_LIMIT_MAX: "3",
    RATE_LIMIT_WINDOW_MS: "60000",
  });

  const app = await buildServer(async (instance) => {
    instance.get("/limited", async () => ({ ok: true }));
  });

  for (let i = 0; i < 3; i += 1) {
    const okResponse = await app.inject({
      method: "GET",
      url: "/limited",
      remoteAddress: "203.0.113.42",
    });
    assert.equal(okResponse.statusCode, 200);
  }

  const limitedResponse = await app.inject({
    method: "GET",
    url: "/limited",
    remoteAddress: "203.0.113.42",
  });

  assert.equal(limitedResponse.statusCode, 429);
});
