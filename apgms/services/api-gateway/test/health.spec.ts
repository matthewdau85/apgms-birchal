import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prismaMock } from "./setup";
import { buildApp, createShutdownHandler } from "../src/index";

describe("health endpoints", () => {
  it("reports liveness", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/healthz" });
    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { ok: true });
    await app.close();
  });

  it("reports readiness when the database is reachable", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/readyz" });
    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { ready: true });
    await app.close();
  });

  it("returns not ready when the database is unreachable", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connection refused"));
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/readyz" });
    assert.strictEqual(response.statusCode, 503);
    const payload = response.json();
    assert.strictEqual(payload.ready, false);
    await app.close();
  });

  it("closes resources gracefully on shutdown", async () => {
    const app = await buildApp();
    const shutdown = createShutdownHandler(app);
    await shutdown("SIGTERM");
    assert.ok(prismaMock.$disconnect.calls.length > 0);
  });
});
