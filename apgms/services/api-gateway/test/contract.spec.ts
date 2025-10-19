import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app";

test("OpenAPI exposes report routes", async (t) => {
  process.env.PRISMA_DISABLED = "true";
  const app = await buildApp({ logger: false });

  t.after(async () => {
    await app.close();
  });

  await app.ready();
  const response = await app.inject({ method: "GET", url: "/openapi.json" });

  assert.equal(response.statusCode, 200);

  const spec = JSON.parse(response.body);

  assert.ok(spec.paths?.["/dashboard/generate-report"], "missing generate-report path");
  assert.ok(
    spec.paths?.["/dashboard/report/{id}/download"],
    "missing report download path",
  );
});
