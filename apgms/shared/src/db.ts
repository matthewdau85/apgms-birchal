import crypto from "node:crypto";
import { createRequire } from "node:module";

import type { PrismaClient } from "@prisma/client";

type OrgRecord = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

type UserRecord = {
  email: string;
  password: string;
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
};

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
  updatedAt: Date;
};

type SelectMap<T> = Partial<Record<keyof T, boolean>>;

type OrderDirection = "asc" | "desc" | undefined;

type MockPrismaClient = {
  org: {
    upsert(args: {
      where: { id: string };
      update: Partial<Omit<OrgRecord, "id">>;
      create: { id: string; name: string };
    }): Promise<OrgRecord>;
  };
  user: {
    upsert(args: {
      where: { email: string };
      update: Partial<Omit<UserRecord, "email">>;
      create: { email: string; password: string; orgId: string };
    }): Promise<UserRecord>;
    findMany(args?: {
      select?: SelectMap<UserRecord>;
      orderBy?: { createdAt?: OrderDirection };
    }): Promise<Partial<UserRecord>[]>;
  };
  bankLine: {
    findMany(args?: {
      orderBy?: { date?: OrderDirection };
      take?: number;
    }): Promise<BankLineRecord[]>;
    create(args: {
      data: {
        orgId: string;
        date: Date;
        amount: number;
        payee: string;
        desc: string;
      };
    }): Promise<BankLineRecord>;
    createMany(args: {
      data: Array<{
        orgId: string;
        date: Date;
        amount: number;
        payee: string;
        desc: string;
      }>;
      skipDuplicates?: boolean;
    }): Promise<{ count: number }>;
  };
  $disconnect(): Promise<void>;
};

type PrismaModule = {
  PrismaClient?: new () => PrismaClient;
};

const require = createRequire(import.meta.url);

function pick<T extends Record<string, unknown>>(record: T, select?: SelectMap<T>): Partial<T> {
  if (!select || Object.keys(select).length === 0) {
    return { ...record };
  }
  const result: Partial<T> = {};
  for (const key of Object.keys(select) as Array<keyof T>) {
    if (select[key]) {
      result[key] = record[key];
    }
  }
  return result;
}

function sortByDate<T extends { date: Date }>(records: T[], direction: OrderDirection = "desc"): T[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...records].sort((a, b) => (a.date.getTime() - b.date.getTime()) * multiplier);
}

function sortByCreatedAt<T extends { createdAt: Date }>(records: T[], direction: OrderDirection = "desc"): T[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...records].sort((a, b) => (a.createdAt.getTime() - b.createdAt.getTime()) * multiplier);
}

function toDuplicateKey(entry: { orgId: string; date: Date; amount: number; payee: string; desc: string }): string {
  return [entry.orgId, entry.date.toISOString(), entry.amount, entry.payee, entry.desc].join("|");
}

function createMockPrisma(): MockPrismaClient {
  const now = new Date("2024-01-15T00:00:00.000Z");
  const orgs: OrgRecord[] = [
    {
      id: "demo-org",
      name: "Demo Org",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const users: UserRecord[] = [
    {
      email: "founder@example.com",
      password: "password123",
      orgId: "demo-org",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const bankLines: BankLineRecord[] = [
    {
      id: crypto.randomUUID(),
      orgId: "demo-org",
      date: new Date("2024-01-13T00:00:00.000Z"),
      amount: 1250.75,
      payee: "Acme",
      desc: "Office fit-out",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      orgId: "demo-org",
      date: new Date("2024-01-14T00:00:00.000Z"),
      amount: -299.99,
      payee: "CloudCo",
      desc: "Monthly sub",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      orgId: "demo-org",
      date: new Date("2024-01-15T00:00:00.000Z"),
      amount: 5000,
      payee: "Birchal",
      desc: "Investment received",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const duplicateKeys = new Set(bankLines.map(toDuplicateKey));

  return {
    org: {
      async upsert({ where, update, create }) {
        const existing = orgs.find((org) => org.id === where.id);
        if (existing) {
          Object.assign(existing, update ?? {}, { updatedAt: new Date() });
          return { ...existing };
        }
        const createdAt = new Date();
        const record: OrgRecord = {
          id: create.id,
          name: create.name,
          createdAt,
          updatedAt: createdAt,
        };
        orgs.push(record);
        return { ...record };
      },
    },
    user: {
      async upsert({ where, update, create }) {
        const existing = users.find((user) => user.email === where.email);
        if (existing) {
          Object.assign(existing, update ?? {}, { updatedAt: new Date() });
          return { ...existing };
        }
        const createdAt = new Date();
        const record: UserRecord = {
          email: create.email,
          password: create.password,
          orgId: create.orgId,
          createdAt,
          updatedAt: createdAt,
        };
        users.push(record);
        return { ...record };
      },
      async findMany(args) {
        const direction = args?.orderBy?.createdAt;
        const sorted = direction ? sortByCreatedAt(users, direction) : [...users];
        return sorted.map((user) => pick(user, args?.select));
      },
    },
    bankLine: {
      async findMany(args) {
        const direction = args?.orderBy?.date;
        const sorted = sortByDate(bankLines, direction);
        const take = args?.take;
        const limited = typeof take === "number" ? sorted.slice(0, Math.max(0, take)) : sorted;
        return limited.map((line) => ({ ...line }));
      },
      async create({ data }) {
        const createdAt = new Date();
        const record: BankLineRecord = {
          id: crypto.randomUUID(),
          orgId: data.orgId,
          date: new Date(data.date),
          amount: data.amount,
          payee: data.payee,
          desc: data.desc,
          createdAt,
          updatedAt: createdAt,
        };
        bankLines.push(record);
        duplicateKeys.add(toDuplicateKey(record));
        return { ...record };
      },
      async createMany({ data, skipDuplicates }) {
        let inserted = 0;
        for (const entry of data) {
          const key = toDuplicateKey(entry);
          if (skipDuplicates && duplicateKeys.has(key)) {
            continue;
          }
          const createdAt = new Date();
          const record: BankLineRecord = {
            id: crypto.randomUUID(),
            orgId: entry.orgId,
            date: new Date(entry.date),
            amount: entry.amount,
            payee: entry.payee,
            desc: entry.desc,
            createdAt,
            updatedAt: createdAt,
          };
          bankLines.push(record);
          duplicateKeys.add(key);
          inserted += 1;
        }
        return { count: inserted };
      },
    },
    async $disconnect() {
      // no-op for the in-memory mock
    },
  } satisfies MockPrismaClient;
}

function instantiatePrisma(): PrismaClient | MockPrismaClient {
  try {
    const mod = require("@prisma/client") as PrismaModule;
    if (mod?.PrismaClient) {
      return new mod.PrismaClient();
    }
  } catch (error) {
    console.warn("Falling back to mock Prisma client", error);
  }
  return createMockPrisma();
}

export const prisma = instantiatePrisma();
