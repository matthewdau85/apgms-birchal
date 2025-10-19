import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createApp } from "../src/app";
import { prisma } from "../../../shared/src/db";
import { redis } from "../src/plugins/redis";
import { simulateEvents, resetSandbox } from "../src/adapters/payto/sandbox";

const AUTH_HEADERS = (orgId: string) => ({
  authorization: "Bearer sandbox-token",
  "x-org-id": orgId,
  "content-type": "application/json",
});

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

test("mandate activation via webhook", async () => {
  await reset();
  const org = await prisma.org.create({ data: { name: "Mandates" } });
  const app = await createApp();
  await app.ready();

  const consentRes = await app.inject({
    method: "POST",
    url: "/bank/consents",
    headers: AUTH_HEADERS(org.id),
    payload: { orgId: org.id, bank: "Bank", accountRef: "444" },
  });
  assert.equal(consentRes.statusCode, 201);
  const consent = consentRes.json();

  const mandateRes = await app.inject({
    method: "POST",
    url: "/bank/mandates",
    headers: AUTH_HEADERS(org.id),
    payload: {
      orgId: org.id,
      bankConnectionId: consent.id,
      reference: "rent",
      amountLimitCents: 50000,
    },
  });
  assert.equal(mandateRes.statusCode, 201);
  const mandate = mandateRes.json();

  const event = simulateEvents().mandate(mandate.id, "ACTIVE");
  const timestamp = new Date().toISOString();
  const nonce = "nonce-1";
  const signature = sign(event.body, timestamp, nonce);

  const webhookRes = await app.inject({
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
  assert.equal(webhookRes.statusCode, 200);

  const getRes = await app.inject({
    method: "GET",
    url: `/bank/mandates/${mandate.id}`,
    headers: {
      authorization: "Bearer sandbox-token",
      "x-org-id": org.id,
    },
  });

  assert.equal(getRes.statusCode, 200);
  const fetched = getRes.json();
  assert.equal(fetched.status, "ACTIVE");
  assert.ok(fetched.latestEvent);
  assert.equal(fetched.latestEvent.kind, "mandate.updated");

  await app.close();
});

test("rejects stale timestamp", async () => {
  await reset();
  const org = await prisma.org.create({ data: { name: "Stale" } });
  const app = await createApp();
  await app.ready();

  const consentRes = await app.inject({
    method: "POST",
    url: "/bank/consents",
    headers: AUTH_HEADERS(org.id),
    payload: { orgId: org.id, bank: "Bank", accountRef: "555" },
  });
  const consent = consentRes.json();

  const mandateRes = await app.inject({
    method: "POST",
    url: "/bank/mandates",
    headers: AUTH_HEADERS(org.id),
    payload: {
      orgId: org.id,
      bankConnectionId: consent.id,
      reference: "rent",
      amountLimitCents: 50000,
    },
  });
  const mandate = mandateRes.json();

  const event = simulateEvents().mandate(mandate.id, "ACTIVE");
  const timestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const nonce = "nonce-stale";
  const signature = sign(event.body, timestamp, nonce);

  const res = await app.inject({
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

  assert.equal(res.statusCode, 401);
  await app.close();
});

test("rejects signature mismatch", async () => {
  await reset();
  const org = await prisma.org.create({ data: { name: "Sig" } });
  const app = await createApp();
  await app.ready();

  const consentRes = await app.inject({
    method: "POST",
    url: "/bank/consents",
    headers: AUTH_HEADERS(org.id),
    payload: { orgId: org.id, bank: "Bank", accountRef: "666" },
  });
  const consent = consentRes.json();

  const mandateRes = await app.inject({
    method: "POST",
    url: "/bank/mandates",
    headers: AUTH_HEADERS(org.id),
    payload: {
      orgId: org.id,
      bankConnectionId: consent.id,
      reference: "rent",
      amountLimitCents: 50000,
    },
  });
  const mandate = mandateRes.json();

  const event = simulateEvents().mandate(mandate.id, "ACTIVE");
  const timestamp = new Date().toISOString();
  const nonce = "nonce-bad";
  const signature = createHmac("sha256", "bad-secret")
    .update(`${timestamp}.${nonce}.${JSON.stringify(event.body)}`)
    .digest("hex");

  const res = await app.inject({
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

  assert.equal(res.statusCode, 401);
  await app.close();
});

test("rejects nonce replay", async () => {
  await reset();
  const org = await prisma.org.create({ data: { name: "Nonce" } });
  const app = await createApp();
  await app.ready();

  const consentRes = await app.inject({
    method: "POST",
    url: "/bank/consents",
    headers: AUTH_HEADERS(org.id),
    payload: { orgId: org.id, bank: "Bank", accountRef: "777" },
  });
  const consent = consentRes.json();

  const mandateRes = await app.inject({
    method: "POST",
    url: "/bank/mandates",
    headers: AUTH_HEADERS(org.id),
    payload: {
      orgId: org.id,
      bankConnectionId: consent.id,
      reference: "rent",
      amountLimitCents: 50000,
    },
  });
  const mandate = mandateRes.json();

  const event = simulateEvents().mandate(mandate.id, "ACTIVE");
  const timestamp = new Date().toISOString();
  const nonce = "nonce-repeat";
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
