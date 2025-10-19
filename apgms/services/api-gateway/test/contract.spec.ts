import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const buildAppModulePath = path.resolve(currentDir, "../src/app.js");
const buildAppPromise = import(pathToFileURL(buildAppModulePath).href);

test("exposes OpenAPI document with report routes", async (t) => {
  const { buildApp } = await buildAppPromise;
  const app = await buildApp();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: "GET", url: "/openapi.json" });
  assert.equal(response.statusCode, 200, "OpenAPI endpoint should be available");

  const payload = response.json();
  assert.ok(
    payload.paths?.["/dashboard/generate-report"],
    "POST /dashboard/generate-report should be defined",
  );
  assert.ok(
    payload.paths?.["/dashboard/report/{id}/download"],
    "GET /dashboard/report/{id}/download should be defined",
  );
});
