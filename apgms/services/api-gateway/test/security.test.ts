import { strict as assert } from "node:assert";
import test from "node:test";
import { InMemoryPrismaClient } from "@apgms/shared";
import { MockKMS } from "../../../shared/crypto/kms";
import { buildApp } from "../src/app";

const TOKENS = {
  admin: "admin-secret",
  operator: "operator-secret",
  auditor: "auditor-secret",
};

test("Permission matrix enforced", async (t) => {
  const prisma = new InMemoryPrismaClient();
  const kms = new MockKMS();
  const app = await buildApp({
    prisma,
    kms,
    roleTokens: TOKENS,
    rateLimit: { max: 100, intervalMs: 1_000 },
  });

  t.after(async () => {
    await app.close();
  });

  await prisma.user.create({
    data: {
      email: "audited@example.com",
      password: "secret",
      orgId: "org-1",
    },
  });

  await prisma.bankLine.create({
    data: {
      orgId: "org-1",
      date: new Date().toISOString(),
      amount: 100,
      payee: "Example",
      desc: "Seed",
    },
  });

  const adminRes = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${TOKENS.admin}` },
  });
  assert.equal(adminRes.statusCode, 200);

  const operatorUsers = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${TOKENS.operator}` },
  });
  assert.equal(operatorUsers.statusCode, 403);

  const auditorLines = await app.inject({
    method: "GET",
    url: "/bank-lines",
    headers: { authorization: `Bearer ${TOKENS.auditor}` },
  });
  assert.equal(auditorLines.statusCode, 200);

  const sessionId = "session-1";
  const csrfToken = await app.issueCsrfToken(sessionId);
  const createRes = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: {
      authorization: `Bearer ${TOKENS.operator}`,
      "x-session-id": sessionId,
      "x-csrf-token": csrfToken,
    },
    payload: {
      orgId: "org-1",
      date: new Date().toISOString(),
      amount: 42,
      payee: "Vendor",
      desc: "Compliant",
    },
  });
  assert.equal(createRes.statusCode, 201);

  const missingCsrf = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: {
      authorization: `Bearer ${TOKENS.operator}`,
      "x-session-id": sessionId,
    },
    payload: {
      orgId: "org-1",
      date: new Date().toISOString(),
      amount: 10,
      payee: "Vendor",
      desc: "Missing token",
    },
  });
  assert.equal(missingCsrf.statusCode, 403);

  const auditorCsrf = await app.issueCsrfToken("aud-session");
  const auditorCreate = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: {
      authorization: `Bearer ${TOKENS.auditor}`,
      "x-session-id": "aud-session",
      "x-csrf-token": auditorCsrf,
    },
    payload: {
      orgId: "org-1",
      date: new Date().toISOString(),
      amount: 10,
      payee: "Vendor",
      desc: "Denied",
    },
  });
  assert.equal(auditorCreate.statusCode, 403);
});
