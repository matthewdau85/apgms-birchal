import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { build } from "../src/index";

describe("health/ready", () => {
  const app = Fastify({ logger: false });
  const apiKey = "test-api-key";

  before(async () => {
    process.env.API_GATEWAY_KEY = apiKey;
    process.env.API_GATEWAY_DISABLE_DB = "true";
    await build(app);
  });

  after(async () => {
    await app.close();
  });

  it("exposes /health", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-api-key": apiKey },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true, service: "api-gateway" });
  });
});
