import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app";

type Org = {
  id: string;
  name: string;
  createdAt: Date;
  deletedAt?: Date | null;
};

type User = {
  id: string;
  orgId: string;
  email: string;
  password: string;
  deletedAt?: Date | null;
};

type BankLine = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  deletedAt?: Date | null;
};

type Rpt = {
  id: string;
  orgId: string;
  kind: string;
  payloadHash: string;
  deletedAt?: Date | null;
};

type AuditEvent = {
  id: string;
  orgId: string;
  action: string;
  actor: string;
  payload: Record<string, unknown>;
};

type MockState = {
  orgs: Org[];
  users: User[];
  bankLines: BankLine[];
  rpts: Rpt[];
  audits: AuditEvent[];
};

type UpdateArgs<T> = { where: { id: string }; data: Partial<T> };

type UpdateManyArgs<T> = { where: { orgId: string }; data: Partial<T> };

type FindManyArgs = { where?: { orgId?: string } };

type CreateArgs<T> = { data: T };

type MockPrisma = {
  org: {
    findUnique: ({ where }: { where: { id: string } }) => Promise<Org | null>;
    update: (args: UpdateArgs<Org>) => Promise<Org>;
  };
  user: {
    findMany: (args: FindManyArgs) => Promise<User[]>;
    updateMany: (args: UpdateManyArgs<User>) => Promise<{ count: number }>;
    update: (args: UpdateArgs<User>) => Promise<User>;
  };
  bankLine: {
    findMany: (args: FindManyArgs) => Promise<BankLine[]>;
    updateMany: (args: UpdateManyArgs<BankLine>) => Promise<{ count: number }>;
    update: (args: UpdateArgs<BankLine>) => Promise<BankLine>;
  };
  rpt: {
    findMany: (args: FindManyArgs) => Promise<Rpt[]>;
    updateMany: (args: UpdateManyArgs<Rpt>) => Promise<{ count: number }>;
    update: (args: UpdateArgs<Rpt>) => Promise<Rpt>;
  };
  auditEvent: {
    create: (args: CreateArgs<Omit<AuditEvent, "id">>) => Promise<AuditEvent>;
  };
};

const clone = <T>(value: T): T => structuredClone(value);

const applyUpdate = <T extends { id: string }>(collection: T[], args: UpdateArgs<T>): T => {
  const target = collection.find((item) => item.id === args.where.id);
  if (!target) {
    throw new Error("not found");
  }
  Object.assign(target, args.data);
  return target;
};

const applyUpdateMany = <T extends { orgId: string }>(
  collection: T[],
  args: UpdateManyArgs<T>
): { count: number } => {
  const targets = collection.filter((item) => item.orgId === args.where.orgId);
  for (const item of targets) {
    Object.assign(item, args.data);
  }
  return { count: targets.length };
};

const applyFindMany = <T extends { orgId: string }>(
  collection: T[],
  args: FindManyArgs
): T[] => {
  if (!args.where?.orgId) {
    return collection.map(clone);
  }
  return collection.filter((item) => item.orgId === args.where?.orgId).map(clone);
};

const createMockPrisma = () => {
  const state: MockState = {
    orgs: [
      { id: "org-1", name: "Org One", createdAt: new Date("2024-01-01T00:00:00Z") },
    ],
    users: [
      {
        id: "user-1",
        orgId: "org-1",
        email: "user1@example.com",
        password: "secret",
      },
      {
        id: "user-2",
        orgId: "org-1",
        email: "user2@example.com",
        password: "secret",
      },
    ],
    bankLines: [
      {
        id: "line-1",
        orgId: "org-1",
        date: new Date("2024-01-10T00:00:00Z"),
        amount: 100,
        payee: "Vendor",
        desc: "Payment",
      },
    ],
    rpts: [
      { id: "rpt-1", orgId: "org-1", kind: "summary", payloadHash: "hash" },
    ],
    audits: [],
  };

  const prisma: MockPrisma = {
    org: {
      findUnique: async ({ where }) =>
        state.orgs.find((org) => org.id === where.id) ?? null,
      update: async (args) => applyUpdate(state.orgs, args),
    },
    user: {
      findMany: async (args) => applyFindMany(state.users, args),
      updateMany: async (args) => applyUpdateMany(state.users, args),
      update: async (args) => applyUpdate(state.users, args),
    },
    bankLine: {
      findMany: async (args) => applyFindMany(state.bankLines, args),
      updateMany: async (args) => applyUpdateMany(state.bankLines, args),
      update: async (args) => applyUpdate(state.bankLines, args),
    },
    rpt: {
      findMany: async (args) => applyFindMany(state.rpts, args),
      updateMany: async (args) => applyUpdateMany(state.rpts, args),
      update: async (args) => applyUpdate(state.rpts, args),
    },
    auditEvent: {
      create: async ({ data }) => {
        const event: AuditEvent = {
          id: `audit-${state.audits.length + 1}`,
          ...clone(data),
        };
        state.audits.push(event);
        return event;
      },
    },
  };

  return { prisma, state };
};

test("admin privacy routes", async (t) => {
  await t.test("rejects non-admin access", async () => {
    const { prisma } = createMockPrisma();
    const app = await buildApp({ prisma });
    const response = await app.inject({
      method: "GET",
      url: "/admin/export?orgId=org-1",
    });

    assert.equal(response.statusCode, 403);
  });

  await t.test("exports org bundle for admin", async () => {
    const { prisma } = createMockPrisma();
    const app = await buildApp({ prisma });
    const response = await app.inject({
      method: "GET",
      url: "/admin/export?orgId=org-1",
      headers: { "x-role": "admin" },
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.org.id, "org-1");
    assert.equal(payload.users.length, 2);
    assert.equal(payload.bankLines.length, 1);
    assert.equal(payload.rpts.length, 1);
  });

  await t.test("soft deletes org data and logs audit", async () => {
    const { prisma, state } = createMockPrisma();
    const app = await buildApp({ prisma });
    const response = await app.inject({
      method: "POST",
      url: "/admin/delete",
      headers: { "x-role": "admin", "x-actor": "tester" },
      payload: { orgId: "org-1" },
    });

    assert.equal(response.statusCode, 200);
    assert.ok(state.orgs[0].deletedAt instanceof Date);
    assert.equal(state.orgs[0].name, "Org One");
    assert.ok(state.users.every((user) => user.deletedAt instanceof Date));
    assert.ok(state.bankLines.every((line) => line.deletedAt instanceof Date));
    assert.ok(state.rpts.every((report) => report.deletedAt instanceof Date));
    assert.equal(state.audits.length, 1);
    assert.deepEqual(state.audits[0], {
      id: "audit-1",
      orgId: "org-1",
      action: "org.delete.soft",
      actor: "tester",
      payload: { hard: false },
    });
  });
});
