import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app";
import { prisma } from "../../../shared/src/db";
import { redis } from "../src/plugins/redis";
import { simulateEvents, resetSandbox } from "../src/adapters/payto/sandbox";
import { createHmac } from "node:crypto";

const WEBHOOK_SECRET = process.env.PAYTO_WEBHOOK_SECRET ?? "sandbox-secret";

async function reset() {
  await prisma.auditBlob.deleteMany();
  await prisma.payToMandate.deleteMany();
  await prisma.bankConnection.deleteMany();
  await prisma.org.deleteMany();
  await redis.reset();
  resetSandbox();
}

function sign(body: Record<string, unknown>, timestamp: string, nonce: string) {
  return createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${nonce}.${JSON.stringify(body)}`)
    .digest("hex");
}

test("rejects replayed payment webhook", async () => {
  await reset();
  const org = await prisma.org.create({ data: { name: "Replay" } });
  const app = await createApp();
  await app.ready();

  const consentRes = await app.inject({
    method: "POST",
    url: "/bank/consents",
    headers: {
      authorization: "Bearer sandbox-token",
      "x-org-id": org.id,
      "content-type": "application/json",
    },
    payload: { orgId: org.id, bank: "Bank", accountRef: "888" },
  });
  const consent = consentRes.json();

  const mandateRes = await app.inject({
    method: "POST",
    url: "/bank/mandates",
    headers: {
      authorization: "Bearer sandbox-token",
      "x-org-id": org.id,
      "content-type": "application/json",
    },
    payload: {
      orgId: org.id,
      bankConnectionId: consent.id,
      reference: "utilities",
      amountLimitCents: 10000,
    },
  });
  const mandate = mandateRes.json();

  const event = simulateEvents().payment(mandate.id, 4200);
  const timestamp = new Date().toISOString();
  const nonce = "nonce-payment";
  const signature = sign(event.body, timestamp, nonce);

  const first = await app.inject({
    method: "POST",
    url: event.endpoint,
    headers: {
      "content-type": "application/json",
      "x-timestamp": timestamp,
      "x-nonce": nonce,
      "x-signature": signature,
    },
    payload: event.body,
  });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({
    method: "POST",
    url: event.endpoint,
    headers: {
      "content-type": "application/json",
      "x-timestamp": timestamp,
      "x-nonce": nonce,
      "x-signature": signature,
    },
    payload: event.body,
  });
  assert.equal(second.statusCode, 409);

  await app.close();
});
