import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fastify from "fastify";
import { healthRoutes } from "../src/routes/ops/health";

let app: ReturnType<typeof fastify>;

before(async () => {
  app = fastify();
  await app.register(healthRoutes);
  await app.listen({ port: 0 });
});

after(async () => {
  await app.close();
});

describe("ops", () => {
  it("health ok", async () => {
    const r = await app.inject({ method: "GET", url: "/health" });
    assert.equal(r.statusCode, 200);
  });
});
