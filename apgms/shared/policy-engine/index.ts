import { createHash } from "node:crypto";

export interface BankLine {
  id: string;
  amount: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface AccountState {
  accountId: string;
  balance: number;
  capacity?: number;
  metadata?: Record<string, unknown>;
}

export interface Allocation {
  accountId: string;
  amount: number;
  ruleId: string;
}

export type Gate =
  | {
      type: "bankLineEquals";
      field: string;
      equals: unknown;
    }
  | {
      type: "accountBalanceAtLeast";
      amount: number;
    }
  | {
      type: "accountMetadataEquals";
      key: string;
      equals: unknown;
    }
  | {
      type: "accountCapacityAvailable";
      minimum: number;
    };

export interface PolicyRule {
  id: string;
  accountId: string;
  weight: number;
  description?: string;
  gates?: Gate[];
}

export interface PolicyRuleset {
  id: string;
  version?: string;
  rules: PolicyRule[];
  metadata?: Record<string, unknown>;
}

export interface PolicyInput {
  bankLine: BankLine;
  ruleset: PolicyRuleset;
  accountStates: AccountState[];
}

export interface PolicyResult {
  allocations: Allocation[];
  policyHash: string;
  explanation: string;
}

export class PolicyEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyEngineError";
  }
}

export function applyPolicy({ bankLine, ruleset, accountStates }: PolicyInput): PolicyResult {
  if (typeof bankLine.amount !== "number" || Number.isNaN(bankLine.amount)) {
    throw new PolicyEngineError("bank line amount must be a valid number");
  }

  const accountsById = new Map(accountStates.map((state) => [state.accountId, state] as const));

  const applicableRules = (ruleset.rules ?? [])
    .filter((rule) => {
      if (rule.weight < 0) {
        throw new PolicyEngineError(`negative weights are not allowed (rule ${rule.id})`);
      }

      const accountState = accountsById.get(rule.accountId);
      if (!accountState) {
        return false;
      }

      return (rule.gates ?? []).every((gate) => evaluateGate(gate, bankLine, accountState));
    })
    .filter((rule) => rule.weight > 0);

  if (applicableRules.length === 0) {
    throw new PolicyEngineError("no applicable rules for bank line");
  }

  const totalWeight = applicableRules.reduce((acc, rule) => acc + rule.weight, 0);
  if (totalWeight <= 0) {
    throw new PolicyEngineError("total weight must be greater than zero");
  }

  const allocations = distribute(bankLine.amount, applicableRules, (rule) => rule.weight).map((amount, index) => ({
    amount,
    accountId: applicableRules[index]!.accountId,
    ruleId: applicableRules[index]!.id,
  }));

  const policyHash = hashSnapshot(ruleset, accountStates);

  const explanation = buildExplanation(bankLine, ruleset, allocations, totalWeight);

  allocations.forEach((allocation) => {
    if (allocation.amount < 0) {
      throw new PolicyEngineError("policy produced a negative allocation");
    }
  });

  return {
    allocations,
    policyHash,
    explanation,
  };
}

function evaluateGate(gate: Gate, bankLine: BankLine, accountState: AccountState): boolean {
  switch (gate.type) {
    case "bankLineEquals": {
      const value = getNestedValue(bankLine.metadata ?? {}, gate.field);
      return deepEqual(value, gate.equals);
    }
    case "accountBalanceAtLeast":
      return accountState.balance >= gate.amount;
    case "accountMetadataEquals": {
      const value = getNestedValue(accountState.metadata ?? {}, gate.key);
      return deepEqual(value, gate.equals);
    }
    case "accountCapacityAvailable": {
      if (typeof accountState.capacity !== "number") {
        return false;
      }
      return accountState.capacity - accountState.balance >= gate.minimum;
    }
    default: {
      const exhaustive: never = gate;
      return exhaustive;
    }
  }
}

function distribute<T>(amount: number, items: T[], weightAccessor: (item: T) => number): number[] {
  const totalWeight = items.reduce((acc, item) => acc + weightAccessor(item), 0);
  if (totalWeight === 0) {
    return items.map(() => 0);
  }
  const raw = items.map((item) => (amount * weightAccessor(item)) / totalWeight);
  const total = raw.reduce((acc, value) => acc + value, 0);
  const diff = amount - total;
  if (raw.length > 0) {
    raw[raw.length - 1] += diff;
  }
  return raw;
}

function hashSnapshot(ruleset: PolicyRuleset, accountStates: AccountState[]): string {
  const canonicalRules = ruleset.rules
    .map((rule) => ({
      id: rule.id,
      accountId: rule.accountId,
      weight: rule.weight,
      description: rule.description ?? null,
      gates: (rule.gates ?? []).map((gate) => canonicalizeGate(gate)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const canonicalAccountStates = accountStates
    .map((state) => ({
      accountId: state.accountId,
      balance: state.balance,
      capacity: state.capacity ?? null,
      metadata: canonicalizeObject(state.metadata ?? {}),
    }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));

  const snapshot = canonicalizeObject({
    ruleset: {
      id: ruleset.id,
      version: ruleset.version ?? null,
      metadata: canonicalizeObject(ruleset.metadata ?? {}),
      rules: canonicalRules,
    },
    accountStates: canonicalAccountStates,
  });

  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function canonicalizeGate(gate: Gate): unknown {
  switch (gate.type) {
    case "bankLineEquals":
      return {
        type: gate.type,
        field: gate.field,
        equals: gate.equals,
      };
    case "accountBalanceAtLeast":
      return {
        type: gate.type,
        amount: gate.amount,
      };
    case "accountMetadataEquals":
      return {
        type: gate.type,
        key: gate.key,
        equals: gate.equals,
      };
    case "accountCapacityAvailable":
      return {
        type: gate.type,
        minimum: gate.minimum,
      };
    default: {
      const exhaustive: never = gate;
      return exhaustive;
    }
  }
}

function canonicalizeObject(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeObject(entry));
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => [key, canonicalizeObject(val)] as const);
  return Object.fromEntries(entries);
}

function buildExplanation(
  bankLine: BankLine,
  ruleset: PolicyRuleset,
  allocations: Allocation[],
  totalWeight: number,
): string {
  const appliedRuleIds = allocations.map((allocation) => allocation.ruleId).join(", ");
  return [
    `Bank line ${bankLine.id} processed under policy ${ruleset.id} (v${ruleset.version ?? "1"}).`,
    `Applied ${allocations.length} of ${ruleset.rules.length} rules (total weight ${totalWeight.toFixed(2)}).`,
    `Allocations issued under rules: ${appliedRuleIds}.`,
  ].join(" ");
}

function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  if (!path) {
    return undefined;
  }
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== "object" || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  const entriesA = Object.entries(a as Record<string, unknown>);
  const entriesB = Object.entries(b as Record<string, unknown>);
  if (entriesA.length !== entriesB.length) {
    return false;
  }
  return entriesA.every(([key, value]) => deepEqual(value, (b as Record<string, unknown>)[key]));
}
