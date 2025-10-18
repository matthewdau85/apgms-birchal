import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEventJob, PaymentLifecycleJob, QueueClient } from "@apgms/shared";
import { reconcileBankFeed } from "../src/modules/reconciliation";

const feed = {
  feedId: "feed-1",
  orgId: "org-9",
  source: "bank-x",
  entries: [
    { id: "1", amount: 100, currency: "AUD", postedAt: "2024-01-01T00:00:00.000Z", description: "Customer payment" },
    { id: "2", amount: -50, currency: "AUD", postedAt: "2024-01-02T00:00:00.000Z", description: "Supplier" },
  ],
};

test("reconcileBankFeed summarises data and enqueues follow-up jobs", async () => {
  const auditCalls: unknown[][] = [];
  const paymentCalls: unknown[][] = [];

  const auditQueue = {
    add: async (...args: unknown[]) => {
      auditCalls.push(args);
    },
  } as unknown as QueueClient<AuditEventJob>;

  const paymentQueue = {
    add: async (...args: unknown[]) => {
      paymentCalls.push(args);
    },
  } as unknown as QueueClient<PaymentLifecycleJob>;

  const result = await reconcileBankFeed(feed, { auditQueue, paymentQueue });

  assert.equal(result.feedId, feed.feedId);
  assert.equal(result.credits, 1);
  assert.equal(result.debits, 1);
  assert.equal(result.total, 50);
  assert.equal(auditCalls.length, 1);
  assert.equal(paymentCalls.length, 1);
});
