import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp, PrismaClientLike } from "../src/app";

interface MockFunction<TArgs extends unknown[] = unknown[], TResult = unknown> {
  (...args: TArgs): TResult;
  calls: TArgs[];
  mockImplementation: (impl: (...args: TArgs) => TResult) => MockFunction<TArgs, TResult>;
  mockResolvedValue: (value: unknown) => MockFunction<TArgs, Promise<unknown>>;
  mockRejectedValue: (error: unknown) => MockFunction<TArgs, Promise<never>>;
  clear: () => void;
}

const createMock = <TArgs extends unknown[] = unknown[], TResult = unknown>(
  impl: (...args: TArgs) => TResult,
): MockFunction<TArgs, TResult> => {
  let implementation = impl;
  const fn = ((...args: TArgs) => {
    fn.calls.push(args);
    return implementation(...args);
  }) as MockFunction<TArgs, TResult>;
  fn.calls = [];
  fn.mockImplementation = (newImpl) => {
    implementation = newImpl;
    return fn;
  };
  fn.mockResolvedValue = (value) => {
    implementation = () => Promise.resolve(value as any) as any;
    return fn as any;
  };
  fn.mockRejectedValue = (error) => {
    implementation = () => Promise.reject(error) as any;
    return fn as any;
  };
  fn.clear = () => {
    fn.calls = [];
  };
  return fn;
};

const createPrismaStub = () => {
  const prisma: PrismaClientLike & {
    user: { findMany: MockFunction<[any], Promise<unknown[]>> };
    bankLine: {
      findMany: MockFunction<[any], Promise<unknown[]>>;
      create: MockFunction<[any], Promise<unknown>>;
    };
  } = {
    user: {
      findMany: createMock(() => Promise.resolve([])),
    },
    bankLine: {
      findMany: createMock(() => Promise.resolve([])),
      create: createMock(() => Promise.resolve({})),
    },
  } as any;

  return prisma;
};

const createdMocks: MockFunction[] = [];

const trackMock = <TArgs extends unknown[] = unknown[], TResult = unknown>(
  mock: MockFunction<TArgs, TResult>,
) => {
  createdMocks.push(mock as MockFunction);
  return mock;
};

afterEach(() => {
  for (const mock of createdMocks) {
    mock.clear();
  }
  createdMocks.length = 0;
});

describe("api-gateway routes", () => {
  it("returns health information", async () => {
    const prisma = createPrismaStub();
    const app = await createApp({ prisma });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/health" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true, service: "api-gateway" });

    await app.close();
  });

  it("lists users using the prisma client", async () => {
    const prisma = createPrismaStub();
    const users = [
      { email: "alpha@example.com", orgId: "org_1", createdAt: new Date("2024-01-01") },
    ];
    prisma.user.findMany = trackMock(createMock(() => Promise.resolve(users)));

    const app = await createApp({ prisma });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/users" });
    const body = response.json() as { users: Array<Record<string, unknown>> };

    assert.equal(response.statusCode, 200);
    assert.deepEqual(prisma.user.findMany.calls[0][0], {
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(body.users.length, 1);
    assert.equal(body.users[0]?.email, users[0]?.email);
    assert.equal(body.users[0]?.orgId, users[0]?.orgId);
    assert.equal(body.users[0]?.createdAt, users[0]?.createdAt.toISOString());

    await app.close();
  });

  it("validates the request body for bank lines", async () => {
    const prisma = createPrismaStub();
    prisma.bankLine.create = trackMock(createMock(() => Promise.resolve({}))); 

    const app = await createApp({ prisma });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {},
    });

    assert.equal(response.statusCode, 422);
    assert.deepEqual(response.json().error, "validation_failed");
    assert.equal(prisma.bankLine.create.calls.length, 0);

    await app.close();
  });

  it("creates a bank line when the payload is valid", async () => {
    const prisma = createPrismaStub();
    const created = { id: "line_1" };
    prisma.bankLine.create = trackMock(createMock(() => Promise.resolve(created)));

    const app = await createApp({ prisma });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "org_123",
        date: "2024-01-01",
        amount: "123.45",
        payee: "Example Pty Ltd",
        desc: "Subscription",
      },
    });

    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.json(), created);
    assert.deepEqual(prisma.bankLine.create.calls[0][0], {
      data: {
        orgId: "org_123",
        date: new Date("2024-01-01"),
        amount: "123.45",
        payee: "Example Pty Ltd",
        desc: "Subscription",
      },
    });

    await app.close();
  });

  it("maps Prisma unique constraint errors to 409", async () => {
    const prisma = createPrismaStub();
    prisma.bankLine.create = trackMock(
      createMock(() => Promise.reject({ code: "P2002" })),
    );

    const app = await createApp({ prisma });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "org_123",
        date: "2024-01-01",
        amount: 100,
        payee: "Example Pty Ltd",
        desc: "Subscription",
      },
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: "conflict" });

    await app.close();
  });

  it("maps Prisma not found errors to 404", async () => {
    const prisma = createPrismaStub();
    prisma.bankLine.create = trackMock(
      createMock(() => Promise.reject({ code: "P2025" })),
    );

    const app = await createApp({ prisma });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "org_123",
        date: "2024-01-01",
        amount: 100,
        payee: "Example Pty Ltd",
        desc: "Subscription",
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { error: "not_found" });

    await app.close();
  });
});
