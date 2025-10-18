import assert from "node:assert/strict";
import test from "node:test";
import { buildRegistriesServer } from "../src/index";

test("registries service reports health", async () => {
  const app = buildRegistriesServer();
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.deepEqual(response.json(), { status: "ok", service: "registries" });
});
