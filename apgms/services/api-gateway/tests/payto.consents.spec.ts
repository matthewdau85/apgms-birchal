import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app";
import { prisma } from "../../../shared/src/db";
import { redis } from "../src/plugins/redis";
import { resetSandbox } from "../src/adapters/payto/sandbox";

async function reset() {
  await prisma.auditBlob.deleteMany();
  await prisma.payToMandate.deleteMany();
  await prisma.bankConnection.deleteMany();
  await prisma.bankLine.deleteMany();
  await prisma.user.deleteMany();
  await prisma.org.deleteMany();
  await redis.reset();
  resetSandbox();
}

test("create consent and read status", async () => {
  await reset();
  const org = await prisma.org.create({ data: { name: "Acme" } });
  const app = await createApp();
  await app.ready();

  const createRes = await app.inject({
    method: "POST",
    url: "/bank/consents",
    headers: {
      authorization: "Bearer sandbox-token",
      "x-org-id": org.id,
      "content-type": "application/json",
    },
    payload: {
      orgId: org.id,
      bank: "AussieBank",
      accountRef: "123456",
    },
  });

  assert.equal(createRes.statusCode, 201);
  const created = createRes.json();
  assert.equal(created.status, "PENDING");
  assert.ok(created.next.url.includes(created.id));

  const getRes = await app.inject({
    method: "GET",
    url: `/bank/consents/${created.id}`,
    headers: {
      authorization: "Bearer sandbox-token",
      "x-org-id": org.id,
    },
  });

  assert.equal(getRes.statusCode, 200);
  const fetched = getRes.json();
  assert.equal(fetched.id, created.id);
  assert.equal(fetched.status, "PENDING");

  await app.close();
});

test("rejects missing auth", async () => {
  await reset();
  const org = await prisma.org.create({ data: { name: "NoAuth" } });
  const app = await createApp();
  await app.ready();

  const res = await app.inject({
    method: "POST",
    url: "/bank/consents",
    payload: { orgId: org.id, bank: "Bank", accountRef: "789" },
  });

  assert.equal(res.statusCode, 401);
  await app.close();
});

test("rejects mismatched org", async () => {
  await reset();
  const org = await prisma.org.create({ data: { name: "Org" } });
  const other = await prisma.org.create({ data: { name: "Other" } });
  const app = await createApp();
  await app.ready();

  const res = await app.inject({
    method: "POST",
    url: "/bank/consents",
    headers: {
      authorization: "Bearer sandbox-token",
      "x-org-id": other.id,
      "content-type": "application/json",
    },
    payload: { orgId: org.id, bank: "Bank", accountRef: "789" },
  });

  assert.equal(res.statusCode, 403);

  await app.close();
});

test("org-scoped consent lookup", async () => {
  await reset();
  const owner = await prisma.org.create({ data: { name: "Owner" } });
  const intruder = await prisma.org.create({ data: { name: "Intruder" } });
  const app = await createApp();
  await app.ready();

  const createRes = await app.inject({
    method: "POST",
    url: "/bank/consents",
    headers: {
      authorization: "Bearer sandbox-token",
      "x-org-id": owner.id,
      "content-type": "application/json",
    },
    payload: {
      orgId: owner.id,
      bank: "Bank",
      accountRef: "321",
    },
  });

  const created = createRes.json();

  const getRes = await app.inject({
    method: "GET",
    url: `/bank/consents/${created.id}`,
    headers: {
      authorization: "Bearer sandbox-token",
      "x-org-id": intruder.id,
    },
  });

  assert.equal(getRes.statusCode, 403);

  await app.close();
});
