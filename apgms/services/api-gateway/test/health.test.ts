import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/index";

test("health endpoint returns ok", async () => {
  const app = await buildApp({ logger: false });

  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true, service: "api-gateway" });

  await app.close();
});
