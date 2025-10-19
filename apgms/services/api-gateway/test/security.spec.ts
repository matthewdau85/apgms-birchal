import assert from "node:assert/strict";
import { after, test } from "node:test";
import Fastify from "fastify";
import securityPlugin from "../src/plugins/security.js";

const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

after(() => {
  if (originalAllowedOrigins === undefined) {
    delete process.env.ALLOWED_ORIGINS;
  } else {
    process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  }
});

const buildApp = async () => {
  const app = Fastify({ logger: false });
  await app.register(securityPlugin);
  return app;
};

test("allows configured origins to complete CORS preflight", async () => {
  process.env.ALLOWED_ORIGINS = "https://example.com";
  const app = await buildApp();

  app.options("/cors", async () => ({ ok: true }));
  await app.ready();

  const response = await app.inject({
    method: "OPTIONS",
    url: "/cors",
    headers: {
      origin: "https://example.com",
      "access-control-request-method": "GET",
    },
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "https://example.com");

  await app.close();
});

test("returns 429 when an IP exceeds the rate limit for a route", async () => {
  process.env.ALLOWED_ORIGINS = "";
  const app = await buildApp();

  app.get("/limited", async () => ({ ok: true }));
  await app.ready();

  for (let i = 0; i < 100; i += 1) {
    const okResponse = await app.inject({
      method: "GET",
      url: "/limited",
      remoteAddress: "203.0.113.5",
    });
    assert.equal(okResponse.statusCode, 200);
  }

  const blocked = await app.inject({
    method: "GET",
    url: "/limited",
    remoteAddress: "203.0.113.5",
  });

  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers["retry-after"]) >= 1);

  await app.close();
});

test("rejects payloads that exceed the 512KB body limit", async () => {
  process.env.ALLOWED_ORIGINS = "";
  const app = await buildApp();

  app.post("/payload", async () => ({ ok: true }));
  await app.ready();

  const oversizedPayload = "a".repeat(512 * 1024 + 1);

  const response = await app.inject({
    method: "POST",
    url: "/payload",
    payload: oversizedPayload,
    headers: { "content-type": "text/plain" },
  });

  assert.equal(response.statusCode, 413);

  await app.close();
});
