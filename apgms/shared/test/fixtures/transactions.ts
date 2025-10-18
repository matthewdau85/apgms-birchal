import { AllocationPolicy, TransactionSample } from "../../src/anomaly/types";

export type LabeledCandidate = {
  transaction: TransactionSample;
  expectedRules: string[];
  note: string;
};

const basePolicy: AllocationPolicy = {
  windowDays: 30,
  categories: {
    Operations: { target: 0.45, tolerance: 0.15 },
    Payroll: { target: 0.35, tolerance: 0.1 },
    Marketing: { target: 0.2, tolerance: 0.1 },
  },
};

const mkTxn = (overrides: Partial<TransactionSample> & { id: string }): TransactionSample => ({
  id: overrides.id,
  orgId: overrides.orgId ?? "org-1",
  date: overrides.date ?? new Date("2024-04-01T00:00:00.000Z"),
  amount: overrides.amount ?? 0,
  payee: overrides.payee ?? "",
  desc: overrides.desc ?? "",
  category: overrides.category ?? "Operations",
});

const startDate = new Date("2024-01-01T00:00:00.000Z");

const baselineHistory = (): TransactionSample[] => {
  const entries: TransactionSample[] = [];
  for (let week = 0; week < 12; week += 1) {
    const base = new Date(startDate.getTime() + week * 7 * 24 * 60 * 60 * 1000);
    entries.push(
      mkTxn({
        id: `ops-${week}`,
        date: new Date(base.getTime()),
        amount: 4800 + (week % 3) * 120,
        payee: "City Utilities",
        desc: "Operational spend",
        category: "Operations",
      })
    );
    entries.push(
      mkTxn({
        id: `payroll-${week}`,
        date: new Date(base.getTime() + 1 * 24 * 60 * 60 * 1000),
        amount: 3600 + (week % 2) * 80,
        payee: "Birchal Payroll",
        desc: "Monthly payroll",
        category: "Payroll",
      })
    );
    entries.push(
      mkTxn({
        id: `marketing-${week}`,
        date: new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000),
        amount: 1900 + (week % 4) * 60,
        payee: "Northwind Media",
        desc: "Campaign spend",
        category: "Marketing",
      })
    );
  }
  return entries;
};

const baseHistory = baselineHistory();

const candidateStream: LabeledCandidate[] = [
  {
    transaction: mkTxn({
      id: "stream-1",
      date: new Date("2024-04-05T00:00:00.000Z"),
      amount: 5100,
      payee: "City Utilities",
      desc: "Operational spend",
      category: "Operations",
    }),
    expectedRules: [],
    note: "Baseline operational payment",
  },
  {
    transaction: mkTxn({
      id: "stream-2",
      date: new Date("2024-04-06T00:00:00.000Z"),
      amount: 34950,
      payee: "Rapid Freight",
      desc: "Emergency logistics",
      category: "Operations",
    }),
    expectedRules: ["velocity_spike"],
    note: "Large spike against normal operations velocity",
  },
  {
    transaction: mkTxn({
      id: "stream-3",
      date: new Date("2024-04-07T00:00:00.000Z"),
      amount: 3550,
      payee: "Birchal Payroll",
      desc: "Monthly payroll",
      category: "Payroll",
    }),
    expectedRules: [],
    note: "Payroll within established range",
  },
  {
    transaction: mkTxn({
      id: "stream-4",
      date: new Date("2024-04-08T00:00:00.000Z"),
      amount: 4100,
      payee: "Zed Ventures",
      desc: "Ad-hoc consulting",
      category: "Operations",
    }),
    expectedRules: ["novel_counterparty"],
    note: "New counterparty compared to historical vendors",
  },
  {
    transaction: mkTxn({
      id: "stream-5",
      date: new Date("2024-04-09T00:00:00.000Z"),
      amount: 2200,
      payee: "Northwind Media",
      desc: "Campaign",
      category: "Marketing",
    }),
    expectedRules: [],
    note: "Marketing spend still compliant",
  },
  {
    transaction: mkTxn({
      id: "stream-6",
      date: new Date("2024-04-10T00:00:00.000Z"),
      amount: 9800,
      payee: "Launch Partners",
      desc: "Product launch activation",
      category: "Marketing",
    }),
    expectedRules: ["allocation_drift"],
    note: "Marketing allocation surge that should breach policy",
  },
  {
    transaction: mkTxn({
      id: "stream-7",
      date: new Date("2024-04-11T00:00:00.000Z"),
      amount: 3600,
      payee: "Birchal Payroll",
      desc: "Payroll",
      category: "Payroll",
    }),
    expectedRules: [],
    note: "Payroll normal",
  },
  {
    transaction: mkTxn({
      id: "stream-8",
      date: new Date("2024-04-12T00:00:00.000Z"),
      amount: 5200,
      payee: "City Utilities",
      desc: "Operations",
      category: "Operations",
    }),
    expectedRules: [],
    note: "Operations slightly above average but not anomalous",
  },
  {
    transaction: mkTxn({
      id: "stream-9",
      date: new Date("2024-04-13T00:00:00.000Z"),
      amount: 1500,
      payee: "Riverside Cafe",
      desc: "Team event",
      category: "Operations",
    }),
    expectedRules: ["novel_counterparty"],
    note: "Another new vendor to ensure rule remains stable",
  },
  {
    transaction: mkTxn({
      id: "stream-10",
      date: new Date("2024-04-14T00:00:00.000Z"),
      amount: 3400,
      payee: "Birchal Payroll",
      desc: "Payroll",
      category: "Payroll",
    }),
    expectedRules: [],
    note: "Payroll trending down, still within tolerance",
  },
];

export const anomalyFixtures = {
  history: baseHistory,
  stream: candidateStream,
  policy: basePolicy,
};
