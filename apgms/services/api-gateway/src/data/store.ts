import { randomUUID } from "node:crypto";

export type Org = {
  id: string;
  name: string;
};

export type User = {
  id: string;
  orgId: string;
  email: string;
};

export type BankLine = {
  id: string;
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  description: string;
};

export type Policy = {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  rules: string[];
  createdAt: string;
  updatedAt: string;
};

type StoreState = {
  orgs: Org[];
  users: User[];
  bankLines: BankLine[];
  policies: Policy[];
};

const now = new Date();

const initialState: StoreState = {
  orgs: [
    { id: "org_1", name: "Birchal Capital" },
    { id: "org_2", name: "Acme Holdings" },
  ],
  users: [
    { id: "user_1", orgId: "org_1", email: "ceo@birchal.test" },
    { id: "user_2", orgId: "org_1", email: "finance@birchal.test" },
    { id: "user_3", orgId: "org_2", email: "accounts@acme.test" },
  ],
  bankLines: [
    {
      id: "line_1",
      orgId: "org_1",
      date: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      amount: 12500.5,
      payee: "ATO",
      description: "GST remittance",
    },
    {
      id: "line_2",
      orgId: "org_1",
      date: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      amount: -3200.0,
      payee: "Birchal Payroll",
      description: "Payroll",
    },
    {
      id: "line_3",
      orgId: "org_2",
      date: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
      amount: 5500.25,
      payee: "FutureFund",
      description: "Capital injection",
    },
  ],
  policies: [
    {
      id: "policy_1",
      name: "Default allocation",
      description: "50/30/20 split across reserve, operations, tax",
      status: "active",
      rules: ["50% to reserve", "30% to operations", "20% to tax"],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ],
};

let state: StoreState = cloneState(initialState);

function cloneState(source: StoreState): StoreState {
  return {
    orgs: source.orgs.map((org) => ({ ...org })),
    users: source.users.map((user) => ({ ...user })),
    bankLines: source.bankLines.map((line) => ({ ...line })),
    policies: source.policies.map((policy) => ({ ...policy })),
  };
}

export function resetStore(): void {
  state = cloneState(initialState);
}

export function getDashboardSummary() {
  const recentBankLines = [...state.bankLines]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return {
    summary: {
      totalOrgs: state.orgs.length,
      totalUsers: state.users.length,
      totalBankLines: state.bankLines.length,
      totalPolicies: state.policies.length,
    },
    recentActivity: {
      bankLines: recentBankLines,
    },
  };
}

export function listBankLines(args: { take: number; cursor?: string }) {
  const { take, cursor } = args;
  const sorted = [...state.bankLines].sort((a, b) => {
    const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.id.localeCompare(b.id);
  });

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = sorted.findIndex((line) => line.id === cursor);
    if (cursorIndex === -1) {
      throw new Error("invalid_cursor");
    }
    startIndex = cursorIndex + 1;
  }

  const items = sorted.slice(startIndex, startIndex + take);
  const nextItem = sorted[startIndex + take];

  return {
    items,
    nextCursor: nextItem ? nextItem.id : null,
  };
}

export function createBankLine(input: {
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  description: string;
}): BankLine {
  const line: BankLine = {
    id: randomUUID(),
    orgId: input.orgId,
    date: new Date(input.date).toISOString(),
    amount: input.amount,
    payee: input.payee,
    description: input.description,
  };
  state.bankLines.push(line);
  return line;
}

export function getAuditReport(orgId: string) {
  const lines = state.bankLines.filter((line) => line.orgId === orgId);
  if (lines.length === 0) {
    return undefined;
  }
  const inflow = lines
    .filter((line) => line.amount >= 0)
    .reduce((sum, line) => sum + line.amount, 0);
  const outflow = lines
    .filter((line) => line.amount < 0)
    .reduce((sum, line) => sum + Math.abs(line.amount), 0);
  const payees = Object.values(
    lines.reduce<Record<string, { name: string; transactions: number; total: number }>>((acc, line) => {
      const existing = acc[line.payee] ?? { name: line.payee, transactions: 0, total: 0 };
      existing.transactions += 1;
      existing.total += line.amount;
      acc[line.payee] = existing;
      return acc;
    }, {}),
  );

  return {
    orgId,
    totals: {
      transactions: lines.length,
      inflow: Number(inflow.toFixed(2)),
      outflow: Number(outflow.toFixed(2)),
      net: Number((inflow - outflow).toFixed(2)),
    },
    payees: payees.map((payee) => ({
      name: payee.name,
      transactions: payee.transactions,
      total: Number(payee.total.toFixed(2)),
    })),
  };
}

export function listLedger(orgId?: string) {
  const entries = orgId
    ? state.bankLines.filter((line) => line.orgId === orgId)
    : [...state.bankLines];
  const sorted = entries.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  return {
    count: sorted.length,
    entries: sorted,
  };
}

export function listPolicies() {
  return [...state.policies].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createPolicy(input: { name: string; description: string; rules: string[] }): Policy {
  const timestamp = new Date().toISOString();
  const policy: Policy = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    rules: [...input.rules],
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.policies.push(policy);
  return policy;
}

export type AllocationSplit = {
  category: string;
  amount: number;
  percentage: number;
};

export type AllocationResult = {
  lineId: string;
  allocations: AllocationSplit[];
};

const ALLOCATION_PRESETS: Array<{ category: string; percentage: number }> = [
  { category: "reserve", percentage: 0.5 },
  { category: "operations", percentage: 0.3 },
  { category: "tax", percentage: 0.2 },
];

export function previewAllocations(input: { orgId: string; lines: { lineId: string; amount: number }[] }) {
  const results: AllocationResult[] = input.lines.map((line) => {
    let allocated = 0;
    const splits = ALLOCATION_PRESETS.map((preset, index) => {
      let amount = Number((line.amount * preset.percentage).toFixed(2));
      if (index === ALLOCATION_PRESETS.length - 1) {
        amount = Number((line.amount - allocated).toFixed(2));
      } else {
        allocated += amount;
      }
      return {
        category: preset.category,
        percentage: Number((preset.percentage * 100).toFixed(2)),
        amount,
      };
    });
    return { lineId: line.lineId, allocations: splits };
  });

  const totalAmount = input.lines.reduce((sum, line) => sum + line.amount, 0);

  return {
    orgId: input.orgId,
    totalAmount: Number(totalAmount.toFixed(2)),
    results,
  };
}

export function applyAllocations(input: { orgId: string; lines: { lineId: string; amount: number }[] }) {
  const preview = previewAllocations(input);
  return {
    ...preview,
    committed: true,
  };
}
