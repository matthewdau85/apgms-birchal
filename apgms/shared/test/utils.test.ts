import { describe, expect, it } from "vitest";
import { calculateRunningBalance, clampTake, normalizeBankLine } from "../src/utils/bankLine";

describe("normalizeBankLine", () => {
  it("leverages the schema transformations", () => {
    const parsed = normalizeBankLine({
      orgId: "acme",
      date: "2024-09-12T00:00:00Z",
      amount: "2500.5",
      payee: "   Supplier  ",
      desc: " Office supplies  ",
    });

    expect(parsed).toMatchObject({
      orgId: "acme",
      amount: 2500.5,
      payee: "Supplier",
      desc: "Office supplies",
    });
    expect(parsed.date).toBeInstanceOf(Date);
  });
});

describe("calculateRunningBalance", () => {
  it("sorts by date and aggregates values", () => {
    const entries = calculateRunningBalance(
      [
        { amount: 100, date: new Date("2024-01-02") },
        { amount: -50.25, date: new Date("2024-01-01") },
      ],
      1000,
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ amount: -50.25, balance: 949.75 });
    expect(entries[1]).toMatchObject({ amount: 100, balance: 1049.75 });
  });
});

describe("clampTake", () => {
  it("clamps to inclusive bounds", () => {
    expect(clampTake(-10)).toBe(1);
    expect(clampTake(50)).toBe(50);
    expect(clampTake(5000)).toBe(200);
  });
});
