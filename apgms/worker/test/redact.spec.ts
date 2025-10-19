import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";

import { runRedactionJob } from "../src/jobs/redact.js";

type UserRecord = {
  id: string;
  email: string | null;
  password: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string | null;
  desc: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

type AuditBlobRecord = {
  event: string;
  payload: unknown;
  redactedAt?: Date;
};

function createPrismaStub({ now }: { now: Date }) {
  const users = new Map<string, UserRecord>();
  const bankLines = new Map<string, BankLineRecord>();
  const auditBlobs: AuditBlobRecord[] = [];

  const staleUser: UserRecord = {
    id: "user-stale",
    email: "stale@example.com",
    password: "hunter2",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    deletedAt: null,
  };

  const freshUser: UserRecord = {
    id: "user-fresh",
    email: "fresh@example.com",
    password: "secret",
    createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    deletedAt: null,
  };

  users.set(staleUser.id, staleUser);
  users.set(freshUser.id, freshUser);

  const staleLine: BankLineRecord = {
    id: "line-stale",
    orgId: "org-1",
    date: new Date("2024-01-05T00:00:00.000Z"),
    amount: 100,
    payee: "Past Vendor",
    desc: "Subscription",
    createdAt: new Date("2024-01-05T00:00:00.000Z"),
    deletedAt: null,
  };

  const freshLine: BankLineRecord = {
    id: "line-fresh",
    orgId: "org-1",
    date: now,
    amount: 42,
    payee: "Current Vendor",
    desc: "Services",
    createdAt: now,
    deletedAt: null,
  };

  bankLines.set(staleLine.id, staleLine);
  bankLines.set(freshLine.id, freshLine);

  return {
    user: {
      async findMany({ where }: { where: { createdAt: { lt: Date }; deletedAt: null } }) {
        return Array.from(users.values()).filter(
          (user) => user.createdAt < where.createdAt.lt && user.deletedAt === null
        );
      },
      async update({ where, data }: { where: { id: string }; data: Partial<UserRecord> }) {
        const current = users.get(where.id);
        assert(current, `user ${where.id} not found`);
        Object.assign(current, data);
        return current;
      },
    },
    bankLine: {
      async findMany({ where }: { where: { createdAt: { lt: Date }; deletedAt: null } }) {
        return Array.from(bankLines.values()).filter(
          (line) => line.createdAt < where.createdAt.lt && line.deletedAt === null
        );
      },
      async update({ where, data }: { where: { id: string }; data: Partial<BankLineRecord> }) {
        const current = bankLines.get(where.id);
        assert(current, `bank line ${where.id} not found`);
        Object.assign(current, data);
        return current;
      },
    },
    auditBlob: {
      async create({ data }: { data: AuditBlobRecord }) {
        auditBlobs.push(data);
        return data;
      },
    },
    data: {
      users,
      bankLines,
      auditBlobs,
    },
  };
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

(async () => {
  const now = new Date("2025-01-01T00:00:00.000Z");
  const retentionDays = 30;
  const prisma = createPrismaStub({ now });

  const summary = await runRedactionJob({ prisma, retentionDays, now });

  assert.equal(summary.dryRun, false);
  assert.equal(summary.retentionDays, retentionDays);
  assert.equal(summary.users.total, 1);
  assert.equal(summary.bankLines.total, 1);
  assert.equal(summary.users.hashed[0].emailHash, hash("stale@example.com"));
  assert.equal(summary.bankLines.hashed[0].payeeHash, hash("Past Vendor"));
  assert.equal(summary.bankLines.hashed[0].descHash, hash("Subscription"));

  const staleUser = prisma.data.users.get("user-stale");
  assert(staleUser);
  assert.equal(staleUser.email, null);
  assert.equal(staleUser.password, null);
  assert(staleUser.deletedAt instanceof Date);
  assert.equal(staleUser.deletedAt?.toISOString(), now.toISOString());

  const freshUser = prisma.data.users.get("user-fresh");
  assert(freshUser);
  assert.equal(freshUser.email, "fresh@example.com");
  assert.equal(freshUser.deletedAt, null);

  const staleLine = prisma.data.bankLines.get("line-stale");
  assert(staleLine);
  assert.equal(staleLine.payee, null);
  assert.equal(staleLine.desc, null);
  assert(staleLine.deletedAt instanceof Date);
  assert.equal(staleLine.deletedAt?.toISOString(), now.toISOString());

  const freshLine = prisma.data.bankLines.get("line-fresh");
  assert(freshLine);
  assert.equal(freshLine.payee, "Current Vendor");
  assert.equal(freshLine.deletedAt, null);

  assert.equal(prisma.data.auditBlobs.length, 1);
  const audit = prisma.data.auditBlobs[0];
  assert.equal(audit.event, "pii.redacted");
  assert(audit.redactedAt instanceof Date);
  assert.equal(audit.redactedAt?.toISOString(), now.toISOString());
  const auditPayload = audit.payload as Record<string, unknown>;
  assert.equal(auditPayload?.retentionDays, retentionDays);

  const hashedUsers = Array.isArray((auditPayload as any)?.users) ? (auditPayload as any).users : [];
  assert.equal(hashedUsers[0]?.id, "user-stale");

  console.log("redact.spec.ts ok");
})();
