import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import securityPlugin from "../src/plugins/security.js";

type EnvOverrides = Record<string, string | undefined>;

const withEnv = (overrides: EnvOverrides) => {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
};

test("Preflight from disallowed origin fails", async (t) => {
  const restoreEnv = withEnv({ NODE_ENV: "development", ALLOWED_ORIGINS: "" });
  t.after(restoreEnv);

  const app = Fastify({ logger: false });
  t.after(async () => {
    await app.close();
  });

  await app.register(securityPlugin);
  app.options("/resource", async () => ({ ok: true }));
  await app.ready();

  const response = await app.inject({
    method: "OPTIONS",
    url: "/resource",
    headers: {
      origin: "https://malicious.example",
      "access-control-request-method": "POST",
    },
  });

  assert.equal(response.statusCode, 403);
});

test("Exceeding the configured RPM returns 429", async (t) => {
  const restoreEnv = withEnv({ NODE_ENV: "development", ALLOWED_ORIGINS: "", RATE_LIMIT_RPM: "2" });
  t.after(restoreEnv);

  const app = Fastify({ logger: false });
  t.after(async () => {
    await app.close();
  });

  await app.register(securityPlugin);
  app.get("/limited", async () => ({ ok: true }));
  await app.ready();

  const first = await app.inject({ method: "GET", url: "/limited" });
  const second = await app.inject({ method: "GET", url: "/limited" });
  const third = await app.inject({ method: "GET", url: "/limited" });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 429);
});

test("Requests exceeding the body limit return 413", async (t) => {
  const restoreEnv = withEnv({
    NODE_ENV: "development",
    ALLOWED_ORIGINS: "",
    BODY_LIMIT_BYTES: "32",
  });
  t.after(restoreEnv);

  const app = Fastify({ logger: false });
  t.after(async () => {
    await app.close();
  });

  await app.register(securityPlugin);
  app.post("/body", async () => ({ ok: true }));
  await app.ready();

  const response = await app.inject({
    method: "POST",
    url: "/body",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ message: "x".repeat(64) }),
  });

  assert.equal(response.statusCode, 413);
});
