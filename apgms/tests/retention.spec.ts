import test from "node:test";
import assert from "node:assert/strict";
import { purgeRetention, type RetentionClient, type RetentionModel } from "../worker/src/purge";

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

class MockAuditModel implements RetentionModel {
  public records: Array<{ id: string; createdAt: Date }>;

  constructor(records: Array<{ id: string; createdAt: Date }>) {
    this.records = records;
  }

  async deleteMany({ where }: { where: Record<string, any> }) {
    const cutoff: Date = where.createdAt.lt;
    const before = this.records.length;
    this.records = this.records.filter((record) => record.createdAt >= cutoff);
    return { count: before - this.records.length };
  }

  async count({ where }: { where: Record<string, any> }) {
    const cutoff: Date = where.createdAt.lt;
    return this.records.filter((record) => record.createdAt < cutoff).length;
  }
}

const now = new Date("2030-01-01T00:00:00.000Z");
const oldAudit = new Date(now.getTime() - 8 * YEAR_MS);
const recentAudit = new Date(now.getTime() - 30 * DAY_MS);

test("purgeRetention reports matches without deleting in dry-run", async () => {
  const auditModel = new MockAuditModel([
    { id: "old", createdAt: oldAudit },
    { id: "recent", createdAt: recentAudit },
  ]);

  const client: RetentionClient = {
    auditLog: auditModel,
  };

  const summary = await purgeRetention(client, { dryRun: true, now });
  const auditRule = summary.find((entry) => entry.model === "auditLog");

  assert.deepEqual(auditRule, {
    model: "auditLog",
    classification: "audit",
    matched: 1,
    dryRun: true,
  });
  assert.equal(auditModel.records.length, 2);
});

test("purgeRetention deletes only aged audit records", async () => {
  const auditModel = new MockAuditModel([
    { id: "old", createdAt: oldAudit },
    { id: "recent", createdAt: recentAudit },
  ]);

  const client: RetentionClient = {
    auditLog: auditModel,
  };

  const summary = await purgeRetention(client, { dryRun: false, now });
  const auditRule = summary.find((entry) => entry.model === "auditLog");

  assert.deepEqual(auditRule, {
    model: "auditLog",
    classification: "audit",
    deleted: 1,
    dryRun: false,
  });
  assert.deepEqual(auditModel.records, [{ id: "recent", createdAt: recentAudit }]);
});
