import { createHash } from "node:crypto";

export interface BankLineInput {
  id: string;
  orgId: string;
  amountCents: number;
  currency: string;
}

export interface AllocationRule {
  bucket: string;
  weight: number;
  minCents?: number;
  memo?: string;
}

export interface Ruleset {
  strategy?: "proportional" | "flat" | string;
  allocations: AllocationRule[];
  gates?: string[];
  noRemittanceBucket?: string;
}

export interface GateState {
  id: string;
  state: string;
}

export interface AccountStates {
  gates?: GateState[];
}

export interface AllocationResult {
  bucket: string;
  amountCents: number;
  currency: string;
  memo?: string;
}

export interface AllocationExplain {
  strategy: string;
  remainderCents: number;
  gateStates: Record<string, string>;
  noRemittance: boolean;
}

export interface AllocateInput {
  bankLine: BankLineInput;
  ruleset: Ruleset;
  accountStates?: AccountStates;
}

export interface AllocateOutput {
  allocations: AllocationResult[];
  policyHash: string;
  explain: AllocationExplain;
}

function stableRuleset(ruleset: Ruleset): Ruleset {
  const sortedAllocations = [...(ruleset.allocations ?? [])]
    .map((rule) => ({ ...rule, weight: Number.isFinite(rule.weight) ? rule.weight : 0 }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
  const sortedGates = [...(ruleset.gates ?? [])].sort();
  return {
    strategy: ruleset.strategy ?? "proportional",
    allocations: sortedAllocations,
    gates: sortedGates,
    noRemittanceBucket: ruleset.noRemittanceBucket,
  };
}

function derivePolicyHash(ruleset: Ruleset): string {
  const normalized = stableRuleset(ruleset);
  const hash = createHash("sha256");
  hash.update(JSON.stringify(normalized));
  return hash.digest("hex");
}

function lookupGateStates(states?: AccountStates): Record<string, string> {
  if (!states?.gates) {
    return {};
  }
  return states.gates.reduce<Record<string, string>>((acc, gate) => {
    acc[gate.id] = gate.state;
    return acc;
  }, {});
}

function computeAllocations(amountCents: number, currency: string, ruleset: Ruleset): AllocationResult[] {
  const normalized = stableRuleset(ruleset);
  const allocations = normalized.allocations.length > 0 ? normalized.allocations : [{ bucket: "unallocated", weight: 1 }];
  const totalWeight = allocations.reduce((sum, rule) => sum + Math.max(rule.weight, 0), 0);
  const cappedAmount = Math.max(amountCents, 0);

  let remaining = cappedAmount;
  const provisional = allocations.map((rule) => {
    const weight = Math.max(rule.weight, 0);
    let share = 0;
    if (totalWeight > 0 && weight > 0) {
      share = Math.floor((cappedAmount * weight) / totalWeight);
    }
    const minCents = Math.max(rule.minCents ?? 0, 0);
    const amount = Math.max(share, minCents);
    remaining -= amount;
    return {
      bucket: rule.bucket,
      amountCents: amount,
      currency,
      memo: rule.memo,
    } satisfies AllocationResult;
  });

  if (remaining !== 0 && provisional.length > 0) {
    const adjustmentIndex = provisional.findIndex((allocation) => allocation.amountCents >= 0);
    if (adjustmentIndex >= 0) {
      provisional[adjustmentIndex] = {
        ...provisional[adjustmentIndex],
        amountCents: provisional[adjustmentIndex].amountCents + remaining,
      };
      remaining = 0;
    }
  }

  return provisional.map((allocation) => ({
    ...allocation,
    amountCents: Math.max(allocation.amountCents, 0),
  }));
}

export function allocate({ bankLine, ruleset, accountStates }: AllocateInput): AllocateOutput {
  const normalizedRuleset = stableRuleset(ruleset);
  const gateStates = lookupGateStates(accountStates);
  const hasClosedGate = normalizedRuleset.gates?.some((gateId) => gateStates[gateId] && gateStates[gateId] !== "OPEN");

  const baseAllocations = hasClosedGate
    ? [{
        bucket: normalizedRuleset.noRemittanceBucket ?? "hold",
        amountCents: Math.max(bankLine.amountCents, 0),
        currency: bankLine.currency,
      }]
    : computeAllocations(bankLine.amountCents, bankLine.currency, normalizedRuleset);

  const totalAllocated = baseAllocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
  const expected = Math.max(bankLine.amountCents, 0);

  let allocations = baseAllocations;
  if (totalAllocated !== expected && allocations.length > 0) {
    const diff = expected - totalAllocated;
    allocations = allocations.map((allocation, index) => {
      if (index === 0) {
        return { ...allocation, amountCents: allocation.amountCents + diff };
      }
      return allocation;
    });
  }

  const sanitizedAllocations = allocations.map((allocation) => ({
    ...allocation,
    amountCents: Math.max(allocation.amountCents, 0),
  }));

  let remainingDiff = expected - sanitizedAllocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
  if (sanitizedAllocations.length > 0 && remainingDiff !== 0) {
    if (remainingDiff > 0) {
      sanitizedAllocations[0] = {
        ...sanitizedAllocations[0],
        amountCents: sanitizedAllocations[0].amountCents + remainingDiff,
      };
    } else {
      let debt = -remainingDiff;
      for (let index = sanitizedAllocations.length - 1; index >= 0 && debt > 0; index -= 1) {
        const current = sanitizedAllocations[index].amountCents;
        const deduction = Math.min(current, debt);
        sanitizedAllocations[index] = {
          ...sanitizedAllocations[index],
          amountCents: current - deduction,
        };
        debt -= deduction;
      }
      if (debt > 0) {
        sanitizedAllocations[0] = { ...sanitizedAllocations[0], amountCents: 0 };
      }
    }
  }

  const finalAllocations = sanitizedAllocations.map((allocation) => ({
    ...allocation,
    amountCents: Math.max(allocation.amountCents, 0),
  }));

  const finalSum = finalAllocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
  if (finalSum !== expected && finalAllocations.length > 0) {
    finalAllocations[0] = {
      ...finalAllocations[0],
      amountCents: Math.max(expected, 0),
    };
    for (let index = 1; index < finalAllocations.length; index += 1) {
      finalAllocations[index] = { ...finalAllocations[index], amountCents: 0 };
    }
  }

  return {
    allocations: finalAllocations,
    policyHash: derivePolicyHash(normalizedRuleset),
    explain: {
      strategy: normalizedRuleset.strategy ?? "proportional",
      remainderCents: Math.max(bankLine.amountCents, 0) - finalAllocations.reduce((sum, allocation) => sum + allocation.amountCents, 0),
      gateStates,
      noRemittance: Boolean(hasClosedGate),
    },
  };
}
