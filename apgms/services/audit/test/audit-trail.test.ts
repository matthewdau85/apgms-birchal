import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEventJob, QueueClient } from "@apgms/shared";
import { createAuditServer } from "../src/server";
import { resetAuditEvents } from "../src/modules/audit-trail";

const sampleEvent: AuditEventJob = {
  eventId: "evt-1",
  entityId: "feed-1",
  eventType: "TEST_EVENT",
  occurredAt: new Date().toISOString(),
  payload: { status: "ok" },
};

test.afterEach(() => {
  resetAuditEvents();
});

test("audit service persists events and forwards to queue", async () => {
  const auditCalls: unknown[][] = [];
  const auditQueue = {
    add: async (...args: unknown[]) => {
      auditCalls.push(args);
    },
  } as unknown as QueueClient<AuditEventJob>;

  const app = createAuditServer({ auditQueue });

  const response = await app.inject({ method: "POST", url: "/events", payload: sampleEvent });
  assert.equal(response.statusCode, 202);
  assert.equal(auditCalls.length, 1);

  const eventsResponse = await app.inject({ method: "GET", url: "/events" });
  const body = eventsResponse.json() as { events: AuditEventJob[] };
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].eventId, sampleEvent.eventId);
});
