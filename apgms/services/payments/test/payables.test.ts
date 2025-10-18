import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEventJob, PaymentLifecycleJob, QueueClient } from "@apgms/shared";
import { createPaymentsServer } from "../src/server";
import { handlePaymentLifecycle } from "../src/modules/payables";

const payload = {
  orgId: "org-10",
  amount: 150,
  dueDate: new Date().toISOString(),
  supplierName: "ACME Pty Ltd",
};

test("payments route queues lifecycle job", async () => {
  const paymentCalls: unknown[][] = [];
  const auditCalls: unknown[][] = [];

  const paymentQueue = {
    add: async (...args: unknown[]) => {
      paymentCalls.push(args);
    },
  } as unknown as QueueClient<PaymentLifecycleJob>;

  const auditQueue = {
    add: async (...args: unknown[]) => {
      auditCalls.push(args);
    },
  } as unknown as QueueClient<AuditEventJob>;

  const app = createPaymentsServer({ paymentQueue, auditQueue });
  const response = await app.inject({ method: "POST", url: "/payments", payload });

  assert.equal(response.statusCode, 202);
  assert.equal(paymentCalls.length, 1);
  assert.equal(auditCalls.length, 1);
});

test("handlePaymentLifecycle emits settlement audit event", async () => {
  const auditCalls: unknown[][] = [];
  const auditQueue = {
    add: async (...args: unknown[]) => {
      auditCalls.push(args);
    },
  } as unknown as QueueClient<AuditEventJob>;

  const result = await handlePaymentLifecycle(
    {
      payableId: "pay-1",
      orgId: payload.orgId,
      amount: payload.amount,
      currency: "AUD",
      dueDate: payload.dueDate,
      supplierName: payload.supplierName,
    },
    auditQueue
  );

  assert.equal(result.payableId, "pay-1");
  assert.equal(result.settled, true);
  assert.equal(auditCalls.length, 1);
});
