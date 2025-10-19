import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import "./setup";
import { buildApp } from "../src/index";

function signPayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload)
    .filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b));
  const serialized = JSON.stringify(Object.fromEntries(entries));
  return crypto
    .createHmac("sha256", process.env.HMAC_SECRET ?? "test-hmac")
    .update(serialized)
    .digest("hex");
}

describe("webhook security", () => {
  it("accepts valid webhook payloads", async () => {
    const app = await buildApp();
    const basePayload = {
      timestamp: Math.floor(Date.now() / 1000),
      nonce: crypto.randomUUID(),
      event: { type: "payto.settled", amount: 1000 },
    };
    const hmac = signPayload(basePayload);
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: { ...basePayload, hmac },
    });
    assert.strictEqual(response.statusCode, 202);
    await app.close();
  });

  it("rejects stale timestamps", async () => {
    const app = await buildApp();
    const basePayload = {
      timestamp: Math.floor((Date.now() - 6 * 60 * 1000) / 1000),
      nonce: crypto.randomUUID(),
      event: { type: "payto.settled" },
    };
    const hmac = signPayload(basePayload);
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: { ...basePayload, hmac },
    });
    assert.strictEqual(response.statusCode, 409);
    await app.close();
  });

  it("prevents nonce replay attempts", async () => {
    const app = await buildApp();
    const nonce = crypto.randomUUID();
    const firstPayload = {
      timestamp: Math.floor(Date.now() / 1000),
      nonce,
      event: { type: "payto.settled" },
    };
    const firstHmac = signPayload(firstPayload);
    const firstResponse = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: { ...firstPayload, hmac: firstHmac },
    });
    assert.strictEqual(firstResponse.statusCode, 202);

    const secondPayload = {
      timestamp: Math.floor(Date.now() / 1000),
      nonce,
      event: { type: "payto.settled" },
    };
    const secondHmac = signPayload(secondPayload);
    const replayResponse = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: { ...secondPayload, hmac: secondHmac },
    });
    assert.strictEqual(replayResponse.statusCode, 409);
    await app.close();
  });

  it("rejects invalid HMAC signatures", async () => {
    const app = await buildApp();
    const payload = {
      timestamp: Math.floor(Date.now() / 1000),
      nonce: crypto.randomUUID(),
      event: { type: "payto.settled" },
      hmac: crypto.randomBytes(32).toString("hex"),
    };
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload,
    });
    assert.strictEqual(response.statusCode, 401);
    await app.close();
  });
});
