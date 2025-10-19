import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { registerSecurity } from "../src/plugins/security.js";

async function createApp() {
  const app = Fastify({ logger: false });
  await registerSecurity(app);

  app.get("/secured", async () => ({ ok: true }));
  app.post("/secured", async (request) => ({ size: JSON.stringify(request.body ?? {}).length }));

  await app.ready();

  return app;
}

let apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
  apps = [];
});

describe("security plugin", () => {
  it("blocks CORS preflight from disallowed origins", async () => {
    process.env.API_GATEWAY_CORS_ALLOWLIST = "https://allowed.test";

    const app = await createApp();
    apps.push(app);

    const response = await app.inject({
      method: "OPTIONS",
      url: "/secured",
      headers: {
        origin: "https://evil.test",
        "access-control-request-method": "GET",
      },
    });

    assert.equal(response.statusCode, 403);
  });

  it("limits requests to 100 per minute", async () => {
    process.env.API_GATEWAY_CORS_ALLOWLIST = "https://allowed.test";
    process.env.API_GATEWAY_RATE_LIMIT_MAX = "100";

    const app = await createApp();
    apps.push(app);

    let lastStatus = 0;
    for (let i = 0; i < 101; i += 1) {
      const response = await app.inject({
        method: "GET",
        url: "/secured",
        headers: {
          origin: "https://allowed.test",
        },
      });

      lastStatus = response.statusCode;
    }

    assert.equal(lastStatus, 429);
  });

  it("rejects bodies larger than 512 KB", async () => {
    process.env.API_GATEWAY_CORS_ALLOWLIST = "https://allowed.test";
    process.env.API_GATEWAY_BODY_LIMIT_BYTES = `${512 * 1024}`;

    const app = await createApp();
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/secured",
      headers: {
        origin: "https://allowed.test",
        "content-type": "application/json",
      },
      body: "{" + `"data":"${"a".repeat(512 * 1024)}"` + "}",
    });

    assert.equal(response.statusCode, 413);
  });
});
