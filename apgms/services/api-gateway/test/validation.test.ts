import type { BankLine } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  createBankLineBodySchema,
  getBankLinesQuerySchema,
  toSerializableBankLine,
  bankLineResponseSchema,
} from "../src/validation";

describe("getBankLinesQuerySchema", () => {
  it("applies defaults and coercion", () => {
    const parsed = getBankLinesQuerySchema.parse({});
    expect(parsed.take).toBe(20);

    const withExplicit = getBankLinesQuerySchema.parse({ take: "5" });
    expect(withExplicit.take).toBe(5);
  });

  it("rejects invalid values", () => {
    const result = getBankLinesQuerySchema.safeParse({ take: "not-a-number" });
    expect(result.success).toBe(false);
  });
});

describe("createBankLineBodySchema", () => {
  it("coerces primitives into runtime types", () => {
    const parsed = createBankLineBodySchema.parse({
      orgId: "org_123",
      date: "2024-01-01",
      amount: "42.5",
      payee: "ACME",
      desc: "Lunch meeting",
    });

    expect(parsed.date).toBeInstanceOf(Date);
    expect(parsed.amount).toBeCloseTo(42.5);
  });

  it("fails when required fields are missing", () => {
    const result = createBankLineBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("toSerializableBankLine", () => {
  it("normalises Prisma objects for responses", () => {
    const bankLine = {
      id: "line_1",
      orgId: "org_123",
      date: new Date("2024-01-01T00:00:00.000Z"),
      amount: { toNumber: () => 123.45 },
      payee: "ACME",
      desc: "Lunch meeting",
      createdAt: new Date("2024-01-02T00:00:00.000Z"),
    } as BankLine;

    const serialised = toSerializableBankLine(bankLine);

    expect(serialised).toMatchObject({
      id: "line_1",
      orgId: "org_123",
      amount: 123.45,
      payee: "ACME",
      desc: "Lunch meeting",
    });
    expect(serialised.date).toBe("2024-01-01T00:00:00.000Z");
    expect(serialised.createdAt).toBe("2024-01-02T00:00:00.000Z");

    expect(() => bankLineResponseSchema.parse(serialised)).not.toThrow();
  });
});
