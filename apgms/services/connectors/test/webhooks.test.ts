import test from "node:test";
import assert from "node:assert/strict";
import { buildServer, type ConnectorEventRecord, type StagingRepository } from "../src/server.js";
import { InMemoryTaxEventQueue } from "@apgms/shared/queue";

type TestContext = {
  queue: InMemoryTaxEventQueue;
  savedEvents: ConnectorEventRecord[];
  server: Awaited<ReturnType<typeof buildServer>>;
};

async function createTestContext(): Promise<TestContext> {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/db";

  const savedEvents: ConnectorEventRecord[] = [];
  const queue = new InMemoryTaxEventQueue();

  const stagingRepo: StagingRepository = {
    async saveEvent(event) {
      const record: ConnectorEventRecord = {
        id: `evt_${savedEvents.length + 1}`,
        receivedAt: new Date(),
        ...event,
      };
      savedEvents.push(record);
      return record;
    },
  };

  const server = await buildServer({
    stagingRepo,
    publisher: {
      async publish(event) {
        queue.publish(event);
      },
    },
  });

  await server.ready();

  return { queue, savedEvents, server };
}

test("connector webhooks persist and enqueue events", async (t) => {
  await t.test("persists payroll runs and publishes to the queue", async () => {
    const ctx = await createTestContext();

    const payload = {
      runId: "run-123",
      orgId: "org-42",
      payPeriod: { start: "2024-01-01", end: "2024-01-15" },
      totalGross: 120000,
      employees: [
        { employeeId: "emp-1", grossPay: 60000 },
        { employeeId: "emp-2", grossPay: 60000 },
      ],
    };

    const response = await ctx.server.inject({
      method: "POST",
      url: "/webhooks/payroll",
      payload,
    });

    assert.equal(response.statusCode, 202);
    assert.equal(ctx.savedEvents.length, 1);
    assert.equal(ctx.savedEvents[0].source, "PAYROLL");
    assert.deepEqual(ctx.savedEvents[0].payload, payload);

    const events = ctx.queue.getEvents();
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      id: ctx.savedEvents[0].id,
      source: "PAYROLL",
      type: "payroll.run",
      payload,
      receivedAt: ctx.savedEvents[0].receivedAt,
    });

    await ctx.server.close();
  });

  await t.test("persists POS transactions and publishes to the queue", async () => {
    const ctx = await createTestContext();

    const payload = {
      transactionId: "txn-77",
      locationId: "loc-9",
      occurredAt: "2024-04-01T12:04:00Z",
      total: 155.4,
      tax: 14.6,
      items: [
        { sku: "coffee", quantity: 2, price: 5.2 },
        { sku: "sandwich", quantity: 3, price: 25 },
      ],
    };

    const response = await ctx.server.inject({
      method: "POST",
      url: "/webhooks/pos",
      payload,
    });

    assert.equal(response.statusCode, 202);
    assert.equal(ctx.savedEvents.length, 1);
    assert.equal(ctx.savedEvents[0].source, "POS");

    const events = ctx.queue.getEvents();
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      id: ctx.savedEvents[0].id,
      source: "POS",
      type: "pos.transaction",
      payload,
      receivedAt: ctx.savedEvents[0].receivedAt,
    });

    await ctx.server.close();
  });
});
