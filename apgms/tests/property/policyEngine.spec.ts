import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  PolicyEngine,
  type ContributionInput,
  type PolicyDefinition,
} from "@apgms/shared/policy-engine";

const tolerance = 1e-6;

const positiveContributionArb = fc.array(
  fc.record<ContributionInput>({
    id: fc.option(fc.uuid(), { nil: undefined }),
    amount: fc.double({ min: 10, max: 2_000, noNaN: true, noDefaultInfinity: true }),
    riskScore: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
    metadata: fc.option(fc.dictionary(fc.string({ maxLength: 8 }), fc.anything()), { nil: undefined }),
  }),
  { minLength: 1, maxLength: 8 },
);

const contributionArb = fc.array(
  fc.record<ContributionInput>({
    id: fc.option(fc.uuid(), { nil: undefined }),
    amount: fc.double({ min: -500, max: 3_000, noNaN: true, noDefaultInfinity: true }),
    riskScore: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
    metadata: fc.option(fc.dictionary(fc.string({ maxLength: 6 }), fc.anything()), { nil: undefined }),
  }),
  { minLength: 1, maxLength: 10 },
);

const gateRuleArb = fc.option(
  fc.oneof(
    fc.record({ type: fc.constant("maxAverageRisk"), threshold: fc.double({ min: 0, max: 1 }) }),
    fc.record({ type: fc.constant("maxSingleRisk"), threshold: fc.double({ min: 0, max: 1 }) }),
    fc.record({ type: fc.constant("minTotal"), threshold: fc.double({ min: 0, max: 4_000 }) }),
    fc.record({ type: fc.constant("maxTotal"), threshold: fc.double({ min: 200, max: 6_000 }) }),
  ),
  { nil: undefined },
);

const policyDefinitionArb = fc.array(
  fc.record<PolicyDefinition>({
    id: fc.uuid(),
    weight: fc.double({ min: 0.1, max: 5, noNaN: true, noDefaultInfinity: true }),
    cap: fc.option(fc.double({ min: 100, max: 6_000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
    floor: fc.option(fc.double({ min: 0, max: 2_000, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
    gate: gateRuleArb,
  }).map((policy) => {
    const cap = policy.cap ?? undefined;
    const floor = policy.floor ?? 0;
    if (cap !== undefined && floor > cap) {
      return { ...policy, cap, floor: cap };
    }
    return { ...policy, cap, floor };
  }),
  { minLength: 1, maxLength: 5 },
);

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

describe("PolicyEngine property invariants", () => {
  it("preserves total funds across the pipeline", () => {
    fc.assert(
      fc.property(policyDefinitionArb, contributionArb, (policies, contributions) => {
        const engine = new PolicyEngine(policies);
        const result = engine.run(contributions);

        const expected = result.totals.input;
        const observed = result.totals.remitted + result.totals.leftover;
        expect(observed).toBeCloseTo(expected, 6);
        expect(result.audit.ok).toBe(true);
      }),
      { numRuns: 120 },
    );
  });

  it("never breaches policy caps or floors", () => {
    fc.assert(
      fc.property(policyDefinitionArb, positiveContributionArb, (policies, contributions) => {
        const engine = new PolicyEngine(policies);
        const result = engine.run(contributions);
        const policyMap = new Map(engine.resolvedPolicies.map((policy) => [policy.id, policy]));

        for (const remittance of result.remittances) {
          const policy = policyMap.get(remittance.policyId);
          expect(policy).toBeDefined();
          if (!policy) {
            continue;
          }
          expect(remittance.amount).toBeGreaterThanOrEqual(0);
          if (Number.isFinite(policy.cap)) {
            expect(remittance.amount).toBeLessThanOrEqual(policy.cap + tolerance);
          }
          if (policy.floor > tolerance && remittance.amount > tolerance) {
            expect(remittance.amount + tolerance).toBeGreaterThanOrEqual(policy.floor);
          }
        }
      }),
      { numRuns: 80 },
    );
  });

  it("rejects allocations when average risk exceeds the threshold", () => {
    fc.assert(
      fc.property(positiveContributionArb, fc.double({ min: 0, max: 0.4 }), (contributions, threshold) => {
        const policies: PolicyDefinition[] = [
          { id: "risk-sensitive", weight: 1, cap: 5_000, gate: { type: "maxAverageRisk", threshold } },
          { id: "overflow", weight: 1, cap: 5_000 },
        ];
        const engine = new PolicyEngine(policies);
        const result = engine.run(contributions);
        const avgRisk = result.gate.context.averageRisk;
        const remitted = sum(result.remittances.filter((item) => item.policyId === "risk-sensitive").map((item) => item.amount));

        if (avgRisk > threshold + tolerance) {
          expect(remitted).toBe(0);
        }
      }),
      { numRuns: 60 },
    );
  });

  it("approves allocations when aggregate volume clears the minimum", () => {
    fc.assert(
      fc.property(positiveContributionArb, fc.double({ min: 200, max: 2_000 }), (contributions, minimum) => {
        const policies: PolicyDefinition[] = [
          { id: "volume", weight: 1, cap: 5_000, gate: { type: "minTotal", threshold: minimum } },
          { id: "other", weight: 1, cap: 5_000 },
        ];
        const engine = new PolicyEngine(policies);
        const result = engine.run(contributions);
        const total = result.totals.input;
        const remitted = sum(result.remittances.filter((item) => item.policyId === "volume").map((item) => item.amount));

        if (total + tolerance < minimum) {
          expect(remitted).toBe(0);
        }
      }),
      { numRuns: 60 },
    );
  });

  it("drops allocations that violate maximum total constraints", () => {
    fc.assert(
      fc.property(positiveContributionArb, fc.double({ min: 500, max: 1_500 }), (contributions, limit) => {
        const policies: PolicyDefinition[] = [
          { id: "limited", weight: 1, cap: 5_000, gate: { type: "maxTotal", threshold: limit } },
          { id: "fallback", weight: 1, cap: 5_000 },
        ];
        const engine = new PolicyEngine(policies);
        const result = engine.run(contributions);
        const total = result.totals.input;
        const remitted = sum(result.remittances.filter((item) => item.policyId === "limited").map((item) => item.amount));

        if (total - tolerance > limit) {
          expect(remitted).toBe(0);
        }
      }),
      { numRuns: 60 },
    );
  });
});
