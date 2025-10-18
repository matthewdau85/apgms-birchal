import { createHash } from "node:crypto";

export type GateState = "OPEN" | "CLOSED";

export interface BankLine {
  id: string;
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  desc: string;
}

export interface AllocationRule {
  accountId: string;
  weight: number;
  gate?: GateState;
  label?: string;
}

export interface AccountState {
  accountId: string;
  balance: number;
}

export interface Ruleset {
  id: string;
  name: string;
  version: string;
  rules: AllocationRule[];
}

export interface PolicyEngineInput {
  bankLine: BankLine;
  ruleset: Ruleset;
  accountStates: AccountState[];
}

export interface AllocationResult {
  accountId: string;
  amount: number;
  ruleId: string;
  weight: number;
  gate: GateState;
}

export interface PolicyEngineResult {
  allocations: AllocationResult[];
  policyHash: string;
  explain: string[];
}

const CENTS = 100;

export function evaluatePolicy(
  input: PolicyEngineInput,
): PolicyEngineResult {
  const { bankLine, ruleset, accountStates } = input;
  const gateForRule = (rule: AllocationRule): GateState => rule.gate ?? "OPEN";

  if (!Number.isFinite(bankLine.amount) || bankLine.amount < 0) {
    throw new Error("bank line amount must be a non-negative finite number");
  }

  if (!Array.isArray(ruleset.rules) || ruleset.rules.length === 0) {
    throw new Error("ruleset must contain at least one rule");
  }

  const totalCents = Math.round(bankLine.amount * CENTS);
  const openRules = ruleset.rules
    .map((rule, index) => ({ rule, index }))
    .filter((entry) => gateForRule(entry.rule) === "OPEN" && entry.rule.weight > 0);

  const totalWeight = openRules.reduce((sum, entry) => sum + entry.rule.weight, 0);

  if (openRules.length === 0 || totalWeight <= 0) {
    throw new Error("ruleset must contain at least one OPEN rule with positive weight");
  }

  let remainingCents = totalCents;
  const openRuleAllocations: number[] = Array(ruleset.rules.length).fill(0);

  openRules.forEach((entry, openIndex) => {
    let cents: number;
    if (openIndex === openRules.length - 1) {
      cents = remainingCents;
    } else {
      cents = Math.floor((totalCents * entry.rule.weight) / totalWeight);
      remainingCents -= cents;
    }
    openRuleAllocations[entry.index] = Math.max(0, cents);
  });

  const accountStateMap = new Map(
    accountStates.map((state) => [state.accountId, state] as const),
  );

  const allocations: AllocationResult[] = ruleset.rules.map((rule, index) => {
    const gate = gateForRule(rule);
    const cents = gate === "OPEN" && rule.weight > 0 ? openRuleAllocations[index] : 0;
    const amount = cents / CENTS;
    return {
      accountId: rule.accountId,
      amount,
      ruleId: `${ruleset.id}#${index}`,
      weight: rule.weight,
      gate,
    };
  });

  const explain = allocations.map((allocation) => {
    const state = accountStateMap.get(allocation.accountId);
    const baseLabel = `Rule ${allocation.ruleId}`;
    if (allocation.gate === "CLOSED") {
      return `${baseLabel}: gate CLOSED, allocation blocked.`;
    }
    const balanceText = state
      ? `prior balance ${state.balance.toFixed(2)}`
      : "no prior balance";
    return `${baseLabel}: allocated ${allocation.amount.toFixed(2)} (${balanceText}).`;
  });

  const policyHash = createHash("sha256")
    .update(
      JSON.stringify({
        bankLine: {
          id: bankLine.id,
          orgId: bankLine.orgId,
          amount: Number(bankLine.amount.toFixed(2)),
          date: bankLine.date,
          payee: bankLine.payee,
          desc: bankLine.desc,
        },
        ruleset,
      }),
    )
    .digest("hex");

  const totalAllocated = allocations.reduce(
    (sum, allocation) => sum + Math.round(allocation.amount * CENTS),
    0,
  );

  if (totalAllocated !== totalCents) {
    throw new Error("allocation conservation invariant violated");
  }

  if (allocations.some((allocation) => allocation.amount < 0)) {
    throw new Error("allocation non-negativity invariant violated");
  }

  return {
    allocations,
    policyHash,
    explain,
  };
}
