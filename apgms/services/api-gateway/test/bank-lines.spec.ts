import Fastify from "fastify";
import assert from "node:assert/strict";
import test from "node:test";
import { createBankLinesRoutes } from "../src/routes/bank-lines";

type AnyArgs = any[];

type AsyncImpl<TResult> = (...args: AnyArgs) => TResult | Promise<TResult>;

class AsyncMock<TResult = unknown> {
  public calls: AnyArgs[] = [];
  private queue: AsyncImpl<TResult>[] = [];
  private fallback?: AsyncImpl<TResult>;

  mockResolvedValueOnce(value: TResult) {
    this.queue.push(() => value);
  }

  mockImplementationOnce(fn: AsyncImpl<TResult>) {
    this.queue.push(fn);
  }

  mockImplementation(fn: AsyncImpl<TResult>) {
    this.fallback = fn;
  }

  reset() {
    this.calls = [];
    this.queue = [];
    this.fallback = undefined;
  }

  async invoke(...args: AnyArgs): Promise<TResult> {
    this.calls.push(args);
    const impl = this.queue.shift() ?? this.fallback;
    if (!impl) {
      throw new Error("No mock implementation provided");
    }
    return await impl(...args);
  }
}

type BankLineMocks = {
  findMany: AsyncMock<any>;
  findUnique: AsyncMock<any>;
  create: AsyncMock<any>;
};

const buildPrismaStub = (mocks: BankLineMocks) => ({
  bankLine: {
    findMany: (...args: AnyArgs) => mocks.findMany.invoke(...args),
    findUnique: (...args: AnyArgs) => mocks.findUnique.invoke(...args),
    create: (...args: AnyArgs) => mocks.create.invoke(...args),
  },
});

test("GET /bank-lines rejects missing orgId", async () => {
  const mocks: BankLineMocks = {
    findMany: new AsyncMock(),
    findUnique: new AsyncMock(),
    create: new AsyncMock(),
  };
  mocks.findMany.mockImplementation(async () => []);

  const app = Fastify();
  await app.register(createBankLinesRoutes({ prisma: buildPrismaStub(mocks) }));

  try {
    const response = await app.inject({ method: "GET", url: "/bank-lines" });
    assert.equal(response.statusCode, 400);
    assert.equal(mocks.findMany.calls.length, 0);
  } finally {
    await app.close();
  }
});

test("GET /bank-lines supports cursor pagination", async () => {
  const mocks: BankLineMocks = {
    findMany: new AsyncMock(),
    findUnique: new AsyncMock(),
    create: new AsyncMock(),
  };

  const pageOne = [
    {
      id: "line-2",
      orgId: "org-1",
      date: new Date("2024-01-02T00:00:00.000Z"),
      amount: "12.34",
      payee: "ACME",
      desc: "Lunch",
      createdAt: new Date("2024-01-02T10:00:00.000Z"),
    },
    {
      id: "line-1",
      orgId: "org-1",
      date: new Date("2024-01-01T00:00:00.000Z"),
      amount: "5.00",
      payee: "Coffee",
      desc: "Morning",
      createdAt: new Date("2024-01-01T09:00:00.000Z"),
    },
  ];

  const pageTwo = [
    {
      id: "line-0",
      orgId: "org-1",
      date: new Date("2023-12-31T00:00:00.000Z"),
      amount: "10.00",
      payee: "Groceries",
      desc: "Dinner",
      createdAt: new Date("2023-12-31T08:00:00.000Z"),
    },
  ];

  mocks.findMany.mockResolvedValueOnce(pageOne);
  mocks.findMany.mockResolvedValueOnce(pageTwo);

  const app = Fastify();
  await app.register(createBankLinesRoutes({ prisma: buildPrismaStub(mocks) }));

  try {
    const firstResponse = await app.inject({
      method: "GET",
      url: "/bank-lines",
      query: { orgId: "org-1", limit: "2" },
    });

    assert.equal(firstResponse.statusCode, 200);
    const firstBody = firstResponse.json() as any;
    assert.equal(firstBody.bankLines.length, 2);
    assert.equal(firstBody.bankLines[0].amountCents, 1234);
    assert.equal(firstBody.bankLines[1].amountCents, 500);
    assert.equal(typeof firstBody.nextCursor, "string");

    const firstCallArgs = mocks.findMany.calls[0][0];
    assert.deepEqual(firstCallArgs.orderBy, [{ date: "desc" }, { id: "desc" }]);
    assert.equal(firstCallArgs.take, 2);
    assert.deepEqual(firstCallArgs.where.orgId, "org-1");

    const secondResponse = await app.inject({
      method: "GET",
      url: "/bank-lines",
      query: { orgId: "org-1", cursor: firstBody.nextCursor },
    });

    assert.equal(secondResponse.statusCode, 200);
    const secondBody = secondResponse.json() as any;
    assert.equal(secondBody.bankLines.length, 1);
    assert.ok(!("nextCursor" in secondBody) || secondBody.nextCursor === undefined);

    const secondCallArgs = mocks.findMany.calls[1][0];
    assert.deepEqual(secondCallArgs.where.orgId, "org-1");
    assert.ok(Array.isArray(secondCallArgs.where.OR));
  } finally {
    await app.close();
  }
});

test("POST /bank-lines enforces idempotency", async () => {
  const mocks: BankLineMocks = {
    findMany: new AsyncMock(),
    findUnique: new AsyncMock(),
    create: new AsyncMock(),
  };

  const createdLine = {
    id: "idem-key",
    orgId: "org-1",
    date: new Date("2024-01-02T00:00:00.000Z"),
    amount: "12.34",
    payee: "ACME",
    desc: "Lunch",
    createdAt: new Date("2024-01-02T10:00:00.000Z"),
  };

  mocks.findUnique.mockResolvedValueOnce(null);
  mocks.create.mockResolvedValueOnce(createdLine);
  mocks.findUnique.mockResolvedValueOnce(createdLine);

  const app = Fastify();
  await app.register(createBankLinesRoutes({ prisma: buildPrismaStub(mocks) }));

  try {
    const firstResponse = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { "idempotency-key": "idem-key" },
      payload: {
        orgId: "org-1",
        date: "2024-01-02T00:00:00.000Z",
        amountCents: 1234,
        payee: "ACME",
        desc: "Lunch",
      },
    });

    assert.equal(firstResponse.statusCode, 201);
    const firstBody = firstResponse.json() as any;
    assert.equal(firstBody.idempotencyReplayed, false);
    assert.equal(firstBody.bankLine.amountCents, 1234);

    const createArgs = mocks.create.calls[0][0];
    assert.equal(createArgs.data.id, "idem-key");
    assert.equal(createArgs.data.orgId, "org-1");
    assert.equal(createArgs.data.payee, "ACME");
    assert.equal(createArgs.data.amount, "12.34");

    const secondResponse = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { "idempotency-key": "idem-key" },
      payload: {
        orgId: "org-1",
        date: "2024-01-02T00:00:00.000Z",
        amountCents: 1234,
        payee: "ACME",
        desc: "Lunch",
      },
    });

    assert.equal(secondResponse.statusCode, 200);
    const secondBody = secondResponse.json() as any;
    assert.equal(secondBody.idempotencyReplayed, true);
    assert.equal(secondBody.bankLine.id, "idem-key");
    assert.equal(mocks.create.calls.length, 1);
  } finally {
    await app.close();
  }
});
