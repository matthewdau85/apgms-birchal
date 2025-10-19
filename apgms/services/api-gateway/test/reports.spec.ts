import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fastify from "fastify";
import { redisPlugin } from "../src/plugins/redis";
import { reportsRoutes } from "../src/routes/v1/reports";

let app: ReturnType<typeof fastify>;

before(async () => {
  app = fastify();
  await app.register(redisPlugin);
  await app.register(reportsRoutes);
  await app.listen({ port: 0 });
});

after(async () => {
  await app.close();
});

describe("reports", () => {
  it("idempotent generate", async () => {
    const body = {
      reportType: "PAYMENT_HISTORY",
      startDate: "2024-07-01",
      endDate: "2024-07-31",
    };
    const key = "idem-abc";

    const r1 = await app.inject({
      method: "POST",
      url: "/dashboard/generate-report",
      payload: body,
      headers: { "idempotency-key": key },
    });
    const r2 = await app.inject({
      method: "POST",
      url: "/dashboard/generate-report",
      payload: body,
      headers: { "idempotency-key": key },
    });

    assert.equal(r1.statusCode, 200);
    assert.equal(r2.statusCode, 200);
    assert.equal(r2.json().reportId, r1.json().reportId);
  });

  it("download returns pdf", async () => {
    const id = "demo-123";
    const r = await app.inject({
      method: "GET",
      url: `/dashboard/report/${id}/download`,
    });
    assert.equal(r.statusCode, 200);
    assert.match(r.headers["content-type"], /application\/pdf/);
  });
});
