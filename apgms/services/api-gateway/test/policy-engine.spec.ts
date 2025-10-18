import fc from "fast-check";
import type { Arbitrary } from "fast-check";
import { describe, expect, it } from "vitest";
import { applyPolicy, GateState } from "../../../shared/policy-engine/index";

const gateValues: GateState[] = ["OPEN", "CLOSED"];

const ruleArb = fc.record({
  accountId: fc.uuid(),
  weight: fc.oneof(fc.constant(undefined), fc.double({ min: 0.1, max: 10, noNaN: true })),
  gate: fc.option(fc.constantFrom(...gateValues), { nil: undefined }),
  label: fc.option(fc.string({ maxLength: 12 }), { nil: undefined }),
});

const accountStateArb = fc.record({
  accountId: fc.uuid(),
  gate: fc.option(fc.constantFrom(...gateValues), { nil: undefined }),
});

interface Scenario {
  bankLine: {
    id: string;
    amount: number;
  };
  ruleset: {
    id: string;
    rules: Array<{
      accountId: string;
      weight?: number;
      gate?: GateState;
      label?: string;
    }>;
  };
  accountStates: Array<{ accountId: string; gate?: GateState }>;
}

const scenarioArb: Arbitrary<Scenario> = fc
  .tuple(
    fc.integer({ min: 0, max: 200_000 }),
    fc.array(ruleArb, { minLength: 1, maxLength: 6 }),
    fc.array(accountStateArb, { minLength: 0, maxLength: 6 }),
  )
  .map(([amountCents, rules, states]) => {
    const uniqueRules: Scenario["ruleset"]["rules"] = [];
    const seen = new Set<string>();
    for (const rule of rules) {
      if (seen.has(rule.accountId)) continue;
      seen.add(rule.accountId);
      uniqueRules.push({ ...rule });
    }

    if (uniqueRules.length === 0) {
      uniqueRules.push({ accountId: `acct-${amountCents}`, weight: 1, gate: "OPEN" });
    }

    uniqueRules[0].gate = "OPEN";
    if (!uniqueRules[0].weight || uniqueRules[0].weight <= 0) {
      uniqueRules[0].weight = 1;
    }

    const stateMap = new Map<string, { accountId: string; gate?: GateState }>();
    for (const state of states) {
      stateMap.set(state.accountId, { ...state });
    }

    const firstState = stateMap.get(uniqueRules[0].accountId);
    if (firstState) {
      firstState.gate = "OPEN";
    } else {
      stateMap.set(uniqueRules[0].accountId, { accountId: uniqueRules[0].accountId, gate: "OPEN" });
    }

    return {
      bankLine: { id: `bank-${amountCents}`, amount: amountCents / 100 },
      ruleset: { id: `rules-${uniqueRules.length}`, rules: uniqueRules },
      accountStates: Array.from(stateMap.values()),
    } satisfies Scenario;
  });

describe("policy engine", () => {
  it("preserves conservation and respects gates", () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const result = applyPolicy(scenario);
        const total = result.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
        expect(total).toBeCloseTo(scenario.bankLine.amount, 2);
        for (const allocation of result.allocations) {
          expect(allocation.amount).toBeGreaterThanOrEqual(0);
          if (allocation.gate === "CLOSED") {
            expect(allocation.amount).toBe(0);
          }
        }
      }),
      { numRuns: 10_000 },
    );
  });
});
