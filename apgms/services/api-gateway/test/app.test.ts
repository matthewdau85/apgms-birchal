import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test, { before } from "node:test";

import { createApp } from "../src/app";
import { bankLineService } from "../src/services/bank-line.service";
import { orgService } from "../src/services/org.service";
import { paymentService } from "../src/services/payment.service";
import { reconciliationService } from "../src/services/reconciliation.service";
import { userService } from "../src/services/user.service";

const TEST_SECRET = "test-secret";

before(() => {
  process.env.AUTH_SECRET = TEST_SECRET;
});

function signToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", TEST_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function buildAuthHeader(overrides?: Partial<{ sub: string; email: string; orgId: string }>): Record<string, string> {
  const token = signToken({
    sub: overrides?.sub ?? "user-1",
    email: overrides?.email ?? "user@example.com",
    orgId: overrides?.orgId ?? "org-1",
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });

  return { authorization: `Bearer ${token}` };
}

async function withApp(handler: (app: Awaited<ReturnType<typeof createApp>>) => Promise<void>): Promise<void> {
  const app = await createApp({ logger: false });
  try {
    await handler(app);
  } finally {
    await app.close();
  }
}

test("health endpoint is publicly accessible", async () => {
  await withApp(async (app) => {
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true, service: "api-gateway" });
  });
});

test("protected routes require authentication", async () => {
  await withApp(async (app) => {
    const response = await app.inject({ method: "GET", url: "/users" });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      error: { code: "unauthorized", message: "Authentication required" },
    });
  });
});

test("users endpoint returns summaries", async () => {
  const original = userService.listUsers;
  userService.listUsers = (async () => [
    { id: "user-1", email: "user@example.com", orgId: "org-1", createdAt: new Date().toISOString() },
  ]) as typeof userService.listUsers;

  try {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/users",
        headers: buildAuthHeader(),
      });

      assert.equal(response.statusCode, 200);
      const body = response.json() as { users: Array<Record<string, unknown>> };
      assert.ok(Array.isArray(body.users));
      assert.equal(body.users.length, 1);
      assert.equal(body.users[0]?.email, "user@example.com");
    });
  } finally {
    userService.listUsers = original;
  }
});

test("bank line creation validates payload", async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: buildAuthHeader(),
      payload: { orgId: "org-1" },
    });

    assert.equal(response.statusCode, 400);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, "validation_error");
  });
});

test("bank line errors are wrapped by the error handler", async () => {
  const original = bankLineService.createBankLine;
  bankLineService.createBankLine = (async () => {
    throw new Error("database down");
  }) as typeof bankLineService.createBankLine;

  try {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/bank-lines",
        headers: buildAuthHeader(),
        payload: {
          orgId: "org-1",
          date: new Date().toISOString(),
          amount: 100,
          payee: "Acme",
          description: "Invoice 123",
        },
      });

      assert.equal(response.statusCode, 500);
      assert.deepEqual(response.json(), {
        error: { code: "internal_server_error", message: "An unexpected error occurred" },
      });
    });
  } finally {
    bankLineService.createBankLine = original;
  }
});

test("missing organisations return a not found error", async () => {
  const original = orgService.getOrgById;
  orgService.getOrgById = (async () => null) as typeof orgService.getOrgById;

  try {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/orgs/missing",
        headers: buildAuthHeader(),
      });

      assert.equal(response.statusCode, 404);
      assert.deepEqual(response.json(), {
        error: { code: "not_found", message: "Organization not found" },
      });
    });
  } finally {
    orgService.getOrgById = original;
  }
});

test("reconciliation endpoint returns aggregates", async () => {
  const original = reconciliationService.getOrgReconciliation;
  reconciliationService.getOrgReconciliation = (async () => ({
    orgId: "org-1",
    totalCredits: 1200,
    totalDebits: -400,
    netBalance: 800,
    transactionCount: 3,
  })) as typeof reconciliationService.getOrgReconciliation;

  try {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/orgs/org-1/reconciliation",
        headers: buildAuthHeader(),
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), {
        orgId: "org-1",
        totalCredits: 1200,
        totalDebits: -400,
        netBalance: 800,
        transactionCount: 3,
      });
    });
  } finally {
    reconciliationService.getOrgReconciliation = original;
  }
});

test("payments endpoints integrate with the payment service", async () => {
  const originalList = paymentService.listPaymentsByOrg;
  paymentService.listPaymentsByOrg = (async () => [
    {
      id: "payment-1",
      orgId: "org-1",
      amount: 250,
      date: new Date().toISOString(),
      payee: "Acme",
      memo: "PAYMENT: Invoice 123",
      createdAt: new Date().toISOString(),
    },
  ]) as typeof paymentService.listPaymentsByOrg;

  const originalCreate = paymentService.createPayment;
  let capturedPayload: Parameters<typeof paymentService.createPayment>[0] | null = null;
  paymentService.createPayment = (async (payload) => {
    capturedPayload = payload;
    return {
      id: "payment-2",
      orgId: payload.orgId,
      amount: payload.amount,
      date: payload.date,
      payee: payload.payee,
      memo: "PAYMENT: Payment to Globex",
      createdAt: new Date().toISOString(),
    };
  }) as typeof paymentService.createPayment;

  try {
    await withApp(async (app) => {
      const listResponse = await app.inject({
        method: "GET",
        url: "/orgs/org-1/payments",
        headers: buildAuthHeader(),
      });

      assert.equal(listResponse.statusCode, 200);
      const listBody = listResponse.json() as { payments: unknown[] };
      assert.ok(Array.isArray(listBody.payments));
      assert.equal(listBody.payments.length, 1);

      const createResponse = await app.inject({
        method: "POST",
        url: "/orgs/org-1/payments",
        headers: buildAuthHeader(),
        payload: {
          amount: 300,
          date: new Date().toISOString(),
          payee: "Globex",
        },
      });

      assert.equal(createResponse.statusCode, 201);
      assert.ok(capturedPayload);
      assert.equal(capturedPayload?.amount, 300);
      assert.equal(capturedPayload?.payee, "Globex");
    });
  } finally {
    paymentService.listPaymentsByOrg = originalList;
    paymentService.createPayment = originalCreate;
  }
});
