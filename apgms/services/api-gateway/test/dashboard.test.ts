import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerDashboardRoutes } from "../src/routes/dashboard";
import { dashboardResponseSchema } from "../src/schemas/dashboard";

const expectedPayload = {
  kpis: {
    operating: 0,
    taxBuffer: 0,
    paygw: 0,
    gst: 0,
  },
  series: [],
};

test("GET /dashboard returns the default dashboard payload", async (t) => {
  const app = Fastify();

  await registerDashboardRoutes(app);
  await app.ready();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/dashboard",
  });

  assert.equal(response.statusCode, 200);

  const payload = dashboardResponseSchema.parse(response.json());
  assert.deepStrictEqual(payload, expectedPayload);
});
