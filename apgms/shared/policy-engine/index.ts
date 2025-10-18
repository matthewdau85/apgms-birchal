import { createHash } from "node:crypto";

export type GateState = "OPEN" | "CLOSED";

export interface BankLine {
  id: string;
  amount: number;
  currency?: string;
}

export interface PolicyRule {
  accountId: string;
  weight?: number;
  gate?: GateState;
  label?: string;
}

export interface Ruleset {
  id: string;
  name?: string;
  rules: PolicyRule[];
}

export interface AccountState {
  accountId: string;
  gate?: GateState;
}

export interface Allocation {
  accountId: string;
  amount: number;
  gate: GateState;
  weight: number;
  reason: string;
}

export interface ApplyPolicyArgs {
  bankLine: BankLine;
  ruleset: Ruleset;
  accountStates: AccountState[];
}

export interface ApplyPolicyResult {
  allocations: Allocation[];
  policyHash: string;
  explain: string[];
}

const SCALE = 100; // cents for conservation precision

interface NormalizedRule {
  accountId: string;
  gate: GateState;
  weight: number;
  label?: string;
}

function normalizeRules(
  ruleset: Ruleset,
  accountStates: AccountState[],
): NormalizedRule[] {
  const stateByAccount = new Map(accountStates.map((state) => [state.accountId, state]));
  const normalized: NormalizedRule[] = [];
  const seen = new Set<string>();

  for (const rule of ruleset.rules) {
    if (seen.has(rule.accountId)) {
      continue;
    }
    seen.add(rule.accountId);

    const state = stateByAccount.get(rule.accountId);
    const combinedGate: GateState =
      rule.gate === "CLOSED" || state?.gate === "CLOSED" ? "CLOSED" : "OPEN";
    const weight = Number.isFinite(rule.weight) && (rule.weight as number) > 0 ? (rule.weight as number) : 1;

    normalized.push({
      accountId: rule.accountId,
      gate: combinedGate,
      weight,
      label: rule.label,
    });
  }

  return normalized;
}

function computePolicyHash(ruleset: Ruleset): string {
  const canonicalRules = [...ruleset.rules]
    .map((rule) => ({
      accountId: rule.accountId,
      gate: rule.gate ?? "OPEN",
      weight: Number.isFinite(rule.weight) && (rule.weight as number) > 0 ? (rule.weight as number) : 1,
      label: rule.label ?? null,
    }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));

  const canonical = JSON.stringify({ id: ruleset.id, name: ruleset.name ?? null, rules: canonicalRules });
  return createHash("sha256").update(canonical).digest("hex");
}

export function applyPolicy({ bankLine, ruleset, accountStates }: ApplyPolicyArgs): ApplyPolicyResult {
  if (!Number.isFinite(bankLine.amount)) {
    throw new Error("bank line amount must be finite");
  }
  if (bankLine.amount < 0) {
    throw new Error("bank line amount must be non-negative");
  }

  const normalizedRules = normalizeRules(ruleset, accountStates);
  const openRules = normalizedRules.filter((rule) => rule.gate === "OPEN");

  if (openRules.length === 0) {
    throw new Error("no open accounts available for allocation");
  }

  const totalWeight = openRules.reduce((acc, rule) => acc + rule.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new Error("invalid total weight");
  }

  const amountInMinorUnits = Math.round(bankLine.amount * SCALE);
  let remaining = amountInMinorUnits;

  const allocations: Allocation[] = normalizedRules.map((rule) => ({
    accountId: rule.accountId,
    amount: 0,
    gate: rule.gate,
    weight: rule.weight,
    reason: rule.gate === "CLOSED" ? "gate_closed" : "weighted_allocation",
  }));

  let openIndex = 0;
  let lastOpenIndex = -1;
  for (let i = 0; i < allocations.length; i += 1) {
    const allocation = allocations[i];
    const rule = normalizedRules[i];
    if (rule.gate === "CLOSED") {
      allocation.amount = 0;
      continue;
    }

    const isLastOpen = openIndex === openRules.length - 1;
    let allocatedMinorUnits: number;
    if (isLastOpen) {
      allocatedMinorUnits = remaining;
    } else {
      const share = (amountInMinorUnits * rule.weight) / totalWeight;
      allocatedMinorUnits = Math.floor(share);
      if (allocatedMinorUnits < 0) {
        allocatedMinorUnits = 0;
      }
    }

    remaining -= allocatedMinorUnits;
    allocation.amount = allocatedMinorUnits / SCALE;
    openIndex += 1;
    lastOpenIndex = i;
  }

  if (Math.abs(remaining) > 1e-9 && lastOpenIndex >= 0) {
    // Adjust the last open allocation with the remaining cents to ensure conservation
    allocations[lastOpenIndex].amount += remaining / SCALE;
    remaining = 0;
  }

  const explain = allocations.map((allocation) =>
    `${allocation.accountId}: gate=${allocation.gate} weight=${allocation.weight} amount=${allocation.amount}`,
  );

  const policyHash = computePolicyHash(ruleset);

  return {
    allocations,
    policyHash,
    explain,
  };
}
