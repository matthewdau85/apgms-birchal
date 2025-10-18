import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEventJob, BankFeedIngestJob, QueueClient } from "@apgms/shared";
import { createConnectorsServer } from "../src/server";

const sampleFeed = {
  feedId: "feed-001",
  orgId: "org-123",
  source: "bank-x",
  entries: [
    { id: "1", amount: 120.55, currency: "AUD", postedAt: new Date().toISOString() },
    { id: "2", amount: -20, currency: "AUD", postedAt: new Date().toISOString() },
  ],
};

test("connectors queues bank feeds and audit events", async () => {
  const bankCalls: unknown[][] = [];
  const auditCalls: unknown[][] = [];

  const bankQueue = {
    add: async (...args: unknown[]) => {
      bankCalls.push(args);
    },
  } as unknown as QueueClient<BankFeedIngestJob>;

  const auditQueue = {
    add: async (...args: unknown[]) => {
      auditCalls.push(args);
    },
  } as unknown as QueueClient<AuditEventJob>;

  const app = createConnectorsServer({ bankFeedQueue: bankQueue, auditQueue });
  const response = await app.inject({ method: "POST", url: "/bank-feeds", payload: sampleFeed });

  assert.equal(response.statusCode, 202);
  const body = response.json() as { feedId: string; queuedJobs: number };
  assert.equal(body.feedId, sampleFeed.feedId);
  assert.equal(body.queuedJobs, sampleFeed.entries.length);
  assert.equal(bankCalls.length, 1);
  assert.equal(auditCalls.length, 1);
});
