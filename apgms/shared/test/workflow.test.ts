import { describe, expect, it, vi } from "vitest";
import {
  createBasDraft,
  matchReconciliation,
  mintRegulatoryReport,
  onboardBusiness,
  scheduleDebit,
  type Transaction
} from "../src";

describe("onboardBusiness", () => {
  it("creates a profile with derived trading name and timestamp", () => {
    const fixedDate = new Date("2024-07-01T00:00:00.000Z");
    const now = vi.fn(() => fixedDate);

    const profile = onboardBusiness(
      {
        legalName: "Birchal Holdings Pty Ltd",
        abn: "12345678901",
        contacts: [{ name: "Casey", email: "casey@example.com" }]
      },
      now
    );

    expect(profile).toMatchObject({
      legalName: "Birchal Holdings Pty Ltd",
      tradingName: "Birchal Holdings Pty Ltd",
      abn: "12345678901",
      primaryContact: { name: "Casey", email: "casey@example.com" },
      createdAt: fixedDate
    });
    expect(profile.id).toMatch(/^ent_/);
  });

  it("validates inputs rigorously", () => {
    expect(() =>
      onboardBusiness({
        legalName: " ",
        abn: "12345678901",
        contacts: [{ name: "Lee", email: "lee@example.com" }]
      })
    ).toThrow(/Legal name/);

    expect(() =>
      onboardBusiness({
        legalName: "Valid",
        abn: "123",
        contacts: [{ name: "Lee", email: "lee@example.com" }]
      })
    ).toThrow(/ABN/);

    expect(() =>
      onboardBusiness({
        legalName: "Valid",
        abn: "12345678901",
        contacts: []
      })
    ).toThrow(/contact/);

    expect(() =>
      onboardBusiness({
        legalName: "Valid",
        abn: "12345678901",
        contacts: [{ name: "Lee", email: "invalid" }]
      })
    ).toThrow(/email/);
  });
});

describe("BAS workflow", () => {
  const transactions: Transaction[] = [
    { id: "s-1", type: "sale", amount: 1000, taxRate: 0.1 },
    { id: "s-2", type: "sale", amount: 500, taxRate: 0.1 },
    { id: "p-1", type: "expense", amount: 200, taxRate: 0.1 },
    { id: "p-2", type: "expense", amount: 50, taxRate: 0 }
  ];

  it("computes totals and warnings for the BAS draft", () => {
    const draft = createBasDraft(transactions);

    expect(draft).toMatchObject({
      totalSales: 1650,
      totalExpenses: 275,
      netPayable: 1375
    });
    expect(draft.warnings).toContain("Transaction p-2 has no GST applied");
  });

  it("handles empty transaction lists with an explicit warning", () => {
    const draft = createBasDraft([]);
    expect(draft).toEqual({
      transactions: [],
      totalSales: 0,
      totalExpenses: 0,
      netPayable: 0,
      warnings: ["No activity for the reporting period"]
    });
  });

  it("matches reconciliation records within tolerance", () => {
    const draft = createBasDraft(transactions);
    const result = matchReconciliation(
      draft,
      [
        { reference: "r-1", amount: 1000.4 },
        { reference: "r-2", amount: 200.6 },
        { reference: "r-3", amount: 10 }
      ],
      1
    );

    expect(result.matched).toBe(2);
    expect(result.unmatched).toHaveLength(1);
    expect(result.matchRate).toBeCloseTo(0.667, 3);
  });

  it("schedules direct debit when cash covers liability", () => {
    const draft = createBasDraft(transactions);
    const now = vi.fn(() => new Date("2024-07-15T00:00:00.000Z"));
    const debit = scheduleDebit(draft, 2000, now);

    expect(debit).toMatchObject({
      amount: 1375,
      scheduledAt: now(),
      status: "scheduled"
    });
    expect(debit.reference).toMatch(/^dd_/);
  });

  it("flags insufficient funds when liability exceeds balance", () => {
    const draft = createBasDraft(transactions);
    const debit = scheduleDebit(draft, 1000);
    expect(debit.status).toBe("insufficient_funds");
  });

  it("mints a regulatory report only when the debit is scheduled", () => {
    const draft = createBasDraft(transactions);
    const debit = scheduleDebit(draft, 2000, () => new Date("2024-07-15T00:00:00.000Z"));
    const report = mintRegulatoryReport(draft, debit, "casey@example.com", () => new Date("2024-07-16T00:00:00.000Z"));

    expect(report).toMatchObject({
      author: "casey@example.com",
      debitReference: debit.reference
    });
    expect(report.hash).toHaveLength(64);

    const failedDebit = scheduleDebit(draft, 10);
    expect(() => mintRegulatoryReport(draft, failedDebit, "author"))
      .toThrow(/debit is scheduled/);
  });
});
