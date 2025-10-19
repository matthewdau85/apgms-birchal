import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import Fastify from "fastify";

import securityPlugin from "../src/plugins/security";

const ORIGINAL_ENV = { ...process.env };

const resetEnv = () => {
  process.env = { ...ORIGINAL_ENV };
};

describe("security plugin", () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  const buildApp = async (allowlist?: string) => {
    if (allowlist !== undefined) {
      process.env.CORS_ALLOWLIST = allowlist;
    }

    const app = Fastify({ logger: false });
    await securityPlugin(app);
    app.get("/resource", async () => ({ ok: true }));
    app.post("/resource", async (request, reply) => {
      reply.send({ received: true, size: (request.body as string)?.length ?? 0 });
    });
    await app.ready();
    return app;
  };

  test("blocks preflight from non-allowlisted origin", async () => {
    const app = await buildApp("https://allowed.example");

    const response = await app.inject({
      method: "OPTIONS",
      url: "/resource",
      headers: {
        origin: "https://blocked.example",
        "access-control-request-method": "GET",
      },
    });

    assert.equal(response.statusCode, 403);

    await app.close();
  });

  test("allows preflight from allowlisted origin", async () => {
    const app = await buildApp("https://allowed.example");

    const response = await app.inject({
      method: "OPTIONS",
      url: "/resource",
      headers: {
        origin: "https://allowed.example",
        "access-control-request-method": "GET",
      },
    });

    assert.equal(response.statusCode, 204);

    await app.close();
  });

  test("returns 429 when rate limit exceeded", async () => {
    const app = await buildApp("https://allowed.example");

    for (let i = 0; i < 100; i += 1) {
      const okResponse = await app.inject({ method: "GET", url: "/resource" });
      assert.equal(okResponse.statusCode, 200);
    }

    const limitedResponse = await app.inject({ method: "GET", url: "/resource" });
    assert.equal(limitedResponse.statusCode, 429);

    await app.close();
  });

  test("returns 413 when body exceeds 512KB", async () => {
    const app = await buildApp("https://allowed.example");

    const payload = "x".repeat(512 * 1024 + 1);

    const response = await app.inject({
      method: "POST",
      url: "/resource",
      headers: {
        "content-type": "text/plain",
        "content-length": String(payload.length),
      },
      payload,
    });

    assert.equal(response.statusCode, 413);

    await app.close();
  });
});
