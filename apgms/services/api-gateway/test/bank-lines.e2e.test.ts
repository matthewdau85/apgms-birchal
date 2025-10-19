import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import Fastify from "fastify";
import cors from "@fastify/cors";

import bankLinesRoutes from "../src/routes/v1/bank-lines";
import redisPlugin from "../src/plugins/redis";

type SortDirection = "asc" | "desc";

type BankLineRecord = {
  id: string;
  orgId: string;
  payee: string;
  desc: string;
  amount: string;
  date: Date;
  createdAt: Date;
};

type BankLineWhereInput = {
  orgId?: string;
  id?: string | { lt?: string };
  date?: {
    equals?: Date;
    lt?: Date;
    gte?: Date;
    lte?: Date;
  };
  payee?: string | { contains: string; mode?: "insensitive" };
  AND?: BankLineWhereInput[];
  OR?: BankLineWhereInput[];
};

type BankLineOrderByInput = { date?: SortDirection; id?: SortDirection };

type FindManyArgs = {
  where?: BankLineWhereInput;
  orderBy?: BankLineOrderByInput | BankLineOrderByInput[];
  take?: number;
};

interface PrismaBankLineModel {
  findMany(args?: FindManyArgs): Promise<BankLineRecord[]>;
  findFirst(args: FindManyArgs): Promise<BankLineRecord | null>;
  findUnique(args: { where: { id?: string } }): Promise<BankLineRecord | null>;
  create(args: { data: Partial<BankLineRecord> & { orgId: string; date: Date; amount: string; payee: string; desc: string } }): Promise<BankLineRecord>;
  update(args: { where: { id?: string }; data: Partial<BankLineRecord> }): Promise<BankLineRecord>;
  delete(args: { where: { id?: string } }): Promise<BankLineRecord>;
}

interface PrismaMock {
  bankLine: PrismaBankLineModel;
  __dangerous__setData(data: BankLineRecord[]): void;
  __dangerous__getData(): BankLineRecord[];
}

class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, mode?: string, exp?: string, ttlSeconds?: number): Promise<"OK" | null> {
    const existing = await this.get(key);
    if (mode === "NX" && existing !== null) {
      return null;
    }
    if (mode === "XX" && existing === null) {
      return null;
    }

    let expiresAt: number | undefined;
    if (exp === "EX" && typeof ttlSeconds === "number") {
      expiresAt = Date.now() + ttlSeconds * 1000;
    }

    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async quit(): Promise<void> {}
}

function matchesWhere(entity: BankLineRecord, where?: BankLineWhereInput): boolean {
  if (!where) return true;
  if (Array.isArray(where.AND)) {
    return where.AND.every((clause) => matchesWhere(entity, clause));
  }
  if (Array.isArray(where.OR)) {
    return where.OR.some((clause) => matchesWhere(entity, clause));
  }

  if (where.orgId && entity.orgId !== where.orgId) {
    return false;
  }

  if (where.id) {
    if (typeof where.id === "string") {
      if (entity.id !== where.id) return false;
    } else if (where.id.lt && !(entity.id < where.id.lt)) {
      return false;
    }
  }

  if (where.date) {
    if (where.date.equals && entity.date.getTime() !== where.date.equals.getTime()) {
      return false;
    }
    if (where.date.lt && !(entity.date.getTime() < where.date.lt.getTime())) {
      return false;
    }
    if (where.date.gte && !(entity.date.getTime() >= where.date.gte.getTime())) {
      return false;
    }
    if (where.date.lte && !(entity.date.getTime() <= where.date.lte.getTime())) {
      return false;
    }
  }

  if (where.payee) {
    if (typeof where.payee === "string") {
      if (entity.payee !== where.payee) return false;
    } else {
      const haystack = where.payee.mode === "insensitive" ? entity.payee.toLowerCase() : entity.payee;
      const needle = where.payee.mode === "insensitive" ? where.payee.contains.toLowerCase() : where.payee.contains;
      if (!haystack.includes(needle)) {
        return false;
      }
    }
  }

  return true;
}

function buildPrismaMock(): PrismaMock {
  let state: BankLineRecord[] = [];

  function sortResults(results: BankLineRecord[], orderBy?: BankLineOrderByInput | BankLineOrderByInput[]) {
    if (!orderBy) return results;
    const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...results].sort((a, b) => {
      for (const order of orders) {
        if (order.date) {
          const comparison = a.date.getTime() - b.date.getTime();
          if (comparison !== 0) {
            return order.date === "desc" ? -comparison : comparison;
          }
        }
        if (order.id && a.id !== b.id) {
          return order.id === "desc" ? (a.id < b.id ? 1 : -1) : a.id < b.id ? -1 : 1;
        }
      }
      return 0;
    });
  }

  const prisma: PrismaMock = {
    bankLine: {
      async findMany(args = {}) {
        const { where, orderBy, take } = args;
        const filtered = state.filter((item) => matchesWhere(item, where));
        const ordered = sortResults(filtered, orderBy);
        return typeof take === "number" ? ordered.slice(0, take) : ordered;
      },
      async findFirst(args) {
        const results = await prisma.bankLine.findMany({ ...args, take: 1 });
        return results[0] ?? null;
      },
      async findUnique({ where }) {
        return state.find((item) => item.id === where.id) ?? null;
      },
      async create({ data }) {
        const now = new Date();
        const record: BankLineRecord = {
          id: `line_${Math.random().toString(16).slice(2)}`,
          createdAt: now,
          date: data.date,
          amount: data.amount,
          desc: data.desc,
          payee: data.payee,
          orgId: data.orgId,
        };
        state = [record, ...state];
        return record;
      },
      async update({ where, data }) {
        const index = state.findIndex((item) => item.id === where.id);
        if (index === -1) {
          throw new Error("Not found");
        }
        const current = state[index];
        const updated: BankLineRecord = {
          ...current,
          date: (data.date as Date | undefined) ?? current.date,
          amount: (data.amount as string | undefined) ?? current.amount,
          payee: (data.payee as string | undefined) ?? current.payee,
          desc: (data.desc as string | undefined) ?? current.desc,
        };
        state[index] = updated;
        return updated;
      },
      async delete({ where }) {
        const index = state.findIndex((item) => item.id === where.id);
        if (index === -1) {
          throw new Error("Not found");
        }
        const [removed] = state.splice(index, 1);
        return removed;
      },
    },
    __dangerous__setData(data) {
      state = data.map((item) => ({ ...item }));
    },
    __dangerous__getData() {
      return state.map((item) => ({ ...item }));
    },
  };

  return prisma;
}

describe("v1 bank lines routes", () => {
  const prismaMock = buildPrismaMock();

  beforeEach(() => {
    const baseDate = new Date("2024-01-01T00:00:00.000Z");
    prismaMock.__dangerous__setData([
      {
        id: "line_a",
        orgId: "org-1",
        payee: "Alpha",
        desc: "First",
        amount: "100",
        date: new Date(baseDate.getTime()),
        createdAt: new Date(baseDate.getTime()),
      },
      {
        id: "line_b",
        orgId: "org-1",
        payee: "Beta",
        desc: "Second",
        amount: "200",
        date: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000),
        createdAt: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000),
      },
      {
        id: "line_c",
        orgId: "org-1",
        payee: "Gamma",
        desc: "Third",
        amount: "300",
        date: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        createdAt: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
    ]);
  });

  async function buildApp() {
    const app = Fastify();
    await app.register(cors, { origin: true });
    const redis = new InMemoryRedis();
    await app.register(redisPlugin, { client: redis as unknown as any });
    await app.register(bankLinesRoutes, { prefix: "/v1", prisma: prismaMock as any, redis: redis as unknown as any });
    return app;
  }

  it("replays duplicate idempotent POST requests", async () => {
    const app = await buildApp();
    const initialCount = prismaMock.__dangerous__getData().length;

    const payload = {
      orgId: "org-1",
      date: "2024-02-01T00:00:00.000Z",
      amount: 450,
      payee: "Delta",
      desc: "Fourth",
    };

    const first = await app.inject({
      method: "POST",
      url: "/v1/bank-lines",
      headers: { "idempotency-key": "abc123" },
      payload,
    });

    assert.strictEqual(first.statusCode, 201);

    const second = await app.inject({
      method: "POST",
      url: "/v1/bank-lines",
      headers: { "idempotency-key": "abc123" },
      payload,
    });

    assert.strictEqual(second.statusCode, 201);
    assert.deepEqual(second.json(), first.json());
    assert.strictEqual(prismaMock.__dangerous__getData().length, initialCount + 1);

    await app.close();
  });

  it("paginates bank lines with cursor", async () => {
    const app = await buildApp();

    const first = await app.inject({
      method: "GET",
      url: "/v1/bank-lines",
      query: { orgId: "org-1", limit: "2" },
    });

    assert.strictEqual(first.statusCode, 200);
    const firstBody = first.json() as { items: BankLineRecord[]; nextCursor?: string };
    assert.strictEqual(firstBody.items.length, 2);
    assert.strictEqual(firstBody.items[0].id, "line_c");
    assert.strictEqual(firstBody.items[1].id, "line_b");
    assert.ok(firstBody.nextCursor);

    const second = await app.inject({
      method: "GET",
      url: "/v1/bank-lines",
      query: { orgId: "org-1", limit: "2", cursor: firstBody.nextCursor! },
    });

    assert.strictEqual(second.statusCode, 200);
    const secondBody = second.json() as { items: BankLineRecord[]; nextCursor?: string };
    assert.strictEqual(secondBody.items.length, 1);
    assert.strictEqual(secondBody.items[0].id, "line_a");
    assert.strictEqual(secondBody.nextCursor, undefined);

    const combinedIds = [...firstBody.items, ...secondBody.items].map((line) => line.id);
    assert.strictEqual(new Set(combinedIds).size, combinedIds.length);

    await app.close();
  });
});
