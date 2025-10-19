import assert from "node:assert/strict";
import test from "node:test";

import { forecastSeries } from "../../../worker/src/pipeline/forecast";
import { createApp } from "../src/app";
import {
  BankLineLike,
  composeUpcomingObligations,
  groupMonthly,
  splitBankLines,
} from "../src/obligations";

const SAMPLE_LINES: (BankLineLike & { orgId: string })[] = [
  { orgId: "org-1", date: new Date("2024-01-21"), amount: -1200, payee: "ATO", desc: "ATO BAS" },
  { orgId: "org-1", date: new Date("2024-02-21"), amount: -1300, payee: "ATO", desc: "ATO BAS" },
  { orgId: "org-1", date: new Date("2024-03-21"), amount: -1250, payee: "ATO", desc: "ATO BAS" },
  { orgId: "org-1", date: new Date("2024-01-15"), amount: -5000, payee: "Payroll", desc: "Monthly payroll" },
  { orgId: "org-1", date: new Date("2024-02-15"), amount: -5200, payee: "Payroll", desc: "Monthly payroll" },
  { orgId: "org-1", date: new Date("2024-03-15"), amount: -5400, payee: "Payroll", desc: "Monthly payroll" },
  { orgId: "org-1", date: new Date("2024-03-01"), amount: 25000, payee: "Client", desc: "Revenue" },
];

test("selects seasonal naive for repeated monthly pattern", () => {
  const series = [1000, 2000, 1000, 2000, 1000, 2000, 1000, 2000];
  const result = forecastSeries(series, { horizon: 1, seasonLength: 2, evaluationWindow: 3 });
  assert.equal(result.method, "seasonal-naive");
});

test("selects ewma for trending data", () => {
  const trend = [1000, 1400, 1800, 2200, 2600, 3000];
  const result = forecastSeries(trend, { horizon: 1, seasonLength: 2, evaluationWindow: 3 });
  assert.equal(result.method, "ewma");
});

test("composes upcoming obligations with due dates and bands", () => {
  const { basMonthly, payrollMonthly, cashOnHandCents } = splitBankLines(SAMPLE_LINES);
  const basHistory = groupMonthly(basMonthly, "M");
  const payrollHistory = groupMonthly(payrollMonthly, "M");
  const composition = composeUpcomingObligations({
    basHistory,
    payrollHistory,
    basFrequency: "M",
    paygwFrequency: "M",
    cashOnHandCents,
    basHorizon: 2,
    paygwHorizon: 2,
  });
  assert.ok(composition.obligations.length >= 2);
  for (const obligation of composition.obligations) {
    assert.match(obligation.dueDate, /\d{4}-\d{2}-\d{2}/);
    assert.ok(obligation.band.p50 <= obligation.band.p80);
    assert.ok(obligation.band.p80 <= obligation.band.p90);
  }
  const basItems = composition.obligations.filter((item) => item.type === "BAS");
  assert.ok(basItems[0].dueDate < basItems[basItems.length - 1].dueDate);
});

test("triggers alert when cash buffer is below threshold", async () => {
  const calls: unknown[] = [];
  const app = createApp({
    prisma: {
      user: { findMany: async () => [] },
      bankLine: {
        findMany: async () => SAMPLE_LINES.map((line) => ({ ...line })),
        create: async () => ({ id: "new" }),
      },
    },
    alertSender: (payload) => {
      calls.push(payload);
    },
  });
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/alerts/subscribe",
    payload: { orgId: "org-1", email: "ops@example.com", thresholdCents: 2000000 },
  });
  const response = await app.inject({ method: "GET", url: "/obligations/upcoming?orgId=org-1" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(Array.isArray(body.obligations));
  assert.ok(calls.length >= 1);
  await app.close();
});

