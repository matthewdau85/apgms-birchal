import { createHash } from "node:crypto";

export type CurrencyCode = "AUD";

export interface BankLine {
  id?: string;
  amountCents: number;
  currency: CurrencyCode;
}

export interface PolicyRule {
  bucket: string;
  weight: number;
}

export interface PolicyRuleset {
  id: string;
  version: string;
  rules: PolicyRule[];
}

export type GateState = "OPEN" | "CLOSED";

export interface AccountState {
  bucket: string;
  gate: GateState;
}

export interface Allocation {
  bucket: string;
  amountCents: number;
  currency: CurrencyCode;
}

export interface ApplyPolicyInput {
  bankLine: BankLine;
  ruleset: PolicyRuleset;
  accountStates?: AccountState[];
}

export interface ApplyPolicyResult {
  allocations: Allocation[];
  policyHash: string;
  explain: string;
}

const DEFAULT_CURRENCY: CurrencyCode = "AUD";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",")}}`;
}

export function applyPolicy({
  bankLine,
  ruleset,
  accountStates = [],
}: ApplyPolicyInput): ApplyPolicyResult {
  if (bankLine.currency !== DEFAULT_CURRENCY) {
    throw new Error(`Unsupported currency: ${bankLine.currency}`);
  }

  if (!Number.isInteger(bankLine.amountCents) || bankLine.amountCents < 0) {
    throw new Error("Bank line amount must be a non-negative integer");
  }

  if (ruleset.rules.length === 0) {
    throw new Error("Ruleset must contain at least one rule");
  }

  const gateMap = new Map(accountStates.map((state) => [state.bucket, state.gate]));

  const openRules = ruleset.rules.filter((rule) => {
    const gate = gateMap.get(rule.bucket) ?? "OPEN";
    return gate === "OPEN";
  });

  if (openRules.length === 0) {
    throw new Error("No open buckets available for allocation");
  }

  for (const rule of openRules) {
    if (!Number.isFinite(rule.weight) || rule.weight <= 0) {
      throw new Error(`Invalid weight for bucket ${rule.bucket}`);
    }
  }

  const totalWeight = openRules.reduce((acc, rule) => acc + rule.weight, 0);
  if (totalWeight <= 0) {
    throw new Error("Total weight must be positive");
  }

  const amount = bankLine.amountCents;

  const interimAllocations = openRules.map((rule) => {
    const exactShare = (amount * rule.weight) / totalWeight;
    const base = Math.floor(exactShare);
    const remainder = exactShare - base;
    return {
      bucket: rule.bucket,
      base,
      remainder,
    };
  });

  let allocated = interimAllocations.reduce((sum, current) => sum + current.base, 0);
  let remainder = amount - allocated;

  if (remainder > 0) {
    const sortedByRemainder = [...interimAllocations].sort((a, b) => {
      if (b.remainder === a.remainder) {
        return a.bucket.localeCompare(b.bucket);
      }
      return b.remainder - a.remainder;
    });

    for (const entry of sortedByRemainder) {
      if (remainder === 0) {
        break;
      }
      entry.base += 1;
      remainder -= 1;
    }
  }

  const allocations: Allocation[] = interimAllocations.map((entry) => ({
    bucket: entry.bucket,
    amountCents: entry.base,
    currency: DEFAULT_CURRENCY,
  }));

  allocated = allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
  if (allocated !== amount) {
    throw new Error("Allocation conservation invariant violated");
  }

  for (const allocation of allocations) {
    if (allocation.amountCents < 0) {
      throw new Error("Allocation amount must be non-negative");
    }
  }

  const policyHash = createHash("sha256")
    .update(
      stableStringify({
        ruleset,
        accountStates: accountStates.map((state) => ({
          bucket: state.bucket,
          gate: state.gate,
        })),
      }),
    )
    .digest("hex");

  const explain = `Applied policy ${ruleset.id}@${ruleset.version} to bank line ${
    bankLine.id ?? "(untracked)"
  } allocating ${allocations.length} bucket(s).`;

  return { allocations, policyHash, explain };
}
