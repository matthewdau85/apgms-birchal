import { beforeEach, describe, expect, it, vi, dynamicImportModule } from "./vitest";

process.env.NODE_ENV = "test";

const bankLineMock = {
  findMany: vi.fn(),
  create: vi.fn(),
};

const userMock = {
  findMany: vi.fn(),
};

const prismaMock = {
  bankLine: bankLineMock,
  user: userMock,
};

const { bankLineCreateSchema, bankLineQuerySchema } = await dynamicImportModule(
  "../src/validation.ts",
);
const { createApp } = await dynamicImportModule("../src/index.ts");

describe("bank line validators", () => {
  beforeEach(() => {
    bankLineMock.findMany.mockReset();
    bankLineMock.create.mockReset();
    userMock.findMany.mockReset();

    bankLineMock.findMany.mockResolvedValue([]);
    userMock.findMany.mockResolvedValue([]);
    bankLineMock.create.mockResolvedValue({
      id: "line_1",
      orgId: "org_1",
      date: new Date("2024-01-02T00:00:00.000Z"),
      amount: 100,
      payee: "Acme",
      desc: "Payment",
      createdAt: new Date("2024-01-03T00:00:00.000Z"),
    });
  });

  it("coerces query take and enforces bounds", () => {
    expect(bankLineQuerySchema.parse({ take: "10" }).take).toBe(10);
    expect(bankLineQuerySchema.safeParse({ take: 0 }).success).toBe(false);
    expect(bankLineQuerySchema.safeParse({ take: 500 }).success).toBe(false);
  });

  it("rejects invalid create payload", () => {
    const result = bankLineCreateSchema.safeParse({
      orgId: "",
      date: "not-a-date",
      amount: "abc",
      payee: "",
      desc: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("returns 400 with schema issues for invalid POST body", async () => {
    const app = await createApp({ prisma: prismaMock as any });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "",
        date: "not-a-date",
        amount: "abc",
        payee: "",
        desc: "",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("validation_error");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(bankLineMock.create).not.toHaveBeenCalled();

    await app.close();
  });

  it("returns 400 for invalid take query", async () => {
    const app = await createApp({ prisma: prismaMock as any });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/bank-lines",
      query: {
        take: "500",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("validation_error");
    expect(body.issues.length).toBeGreaterThan(0);
    expect(bankLineMock.findMany).not.toHaveBeenCalled();

    await app.close();
  });
});
