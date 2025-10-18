import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildApp } from "../src/index.ts";

process.env.NODE_ENV ??= "test";
process.env.PAYTO_WEBHOOK_SECRET ??= "test-secret";

const app = await buildApp({ logger: false });

const report = {
  same_body_200: false,
  diff_body_409: false,
  "stale_>=400": false,
};

const secret = process.env.PAYTO_WEBHOOK_SECRET ?? "";

function signPayload(body: unknown, timestamp: string, nonce: string) {
  const json = JSON.stringify(body);
  const mac = createHmac("sha256", secret);
  mac.update(`${timestamp}.${nonce}.${json}`);
  return { payload: json, signature: mac.digest("hex") };
}

test("POST /webhooks/payto anti-replay", async (t) => {
  await t.test("Case A: identical replay returns 200", async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomUUID();
    const idempotencyKey = "case-a-key";
    const body = { event: "payment.accepted", amount: 1250 };
    const { payload, signature } = signPayload(body, timestamp, nonce);

    const first = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-payto-nonce": nonce,
        "x-payto-timestamp": timestamp,
        "x-payto-signature": signature,
      },
      payload,
    });

    assert.equal(first.statusCode, 202);
    const firstBody = first.json();

    const second = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-payto-nonce": nonce,
        "x-payto-timestamp": timestamp,
        "x-payto-signature": signature,
      },
      payload,
    });

    assert.equal(second.statusCode, 200);
    assert.deepEqual(second.json(), firstBody);

    report.same_body_200 = true;
  });

  await t.test("Case B: conflicting replay returns 409", async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomUUID();
    const idempotencyKey = "case-b-key";

    const bodyA = { event: "payment.accepted", amount: 2000 };
    const signedA = signPayload(bodyA, timestamp, nonce);
    const first = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-payto-nonce": nonce,
        "x-payto-timestamp": timestamp,
        "x-payto-signature": signedA.signature,
      },
      payload: signedA.payload,
    });

    assert.equal(first.statusCode, 202);

    const bodyB = { event: "payment.accepted", amount: 2100 };
    const signedB = signPayload(bodyB, timestamp, nonce);
    const second = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-payto-nonce": nonce,
        "x-payto-timestamp": timestamp,
        "x-payto-signature": signedB.signature,
      },
      payload: signedB.payload,
    });

    assert.equal(second.statusCode, 409);

    report.diff_body_409 = true;
  });

  await t.test("Case C: stale timestamp rejected", async () => {
    const timestamp = Math.floor((Date.now() - 6 * 60 * 1000) / 1000).toString();
    const nonce = randomUUID();
    const idempotencyKey = "case-c-key";
    const body = { event: "payment.accepted", amount: 900 };
    const { payload, signature } = signPayload(body, timestamp, nonce);

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-payto-nonce": nonce,
        "x-payto-timestamp": timestamp,
        "x-payto-signature": signature,
      },
      payload,
    });

    assert.ok(response.statusCode >= 400);
    const bodyJson = response.json();
    const message = typeof bodyJson === "object" && bodyJson !== null ? (bodyJson.message as string | undefined) : undefined;
    assert.ok(typeof message === "string" && message.toLowerCase().includes("stale"));

    report["stale_>=400"] = true;
  });
});

after(async () => {
  await app.close();
  const reportUrl = new URL("../reports/replay.json", import.meta.url);
  const reportPath = fileURLToPath(reportUrl);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
});
