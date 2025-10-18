import assert from "node:assert/strict";
import test from "node:test";
import { buildCdrServer } from "../src/index";

test("cdr service reports health", async () => {
  const app = buildCdrServer();
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.deepEqual(response.json(), { status: "ok", service: "cdr" });
});
