import assert from "node:assert/strict";
import test from "node:test";
import { buildSbrServer } from "../src/index";

test("sbr service reports health", async () => {
  const app = buildSbrServer();
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.deepEqual(response.json(), { status: "ok", service: "sbr" });
});
