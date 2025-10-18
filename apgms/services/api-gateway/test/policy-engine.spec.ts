import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

import { applyPolicy, type ApplyPolicyInput } from "shared/policy-engine/index.js";

function policyInputArb(options: { requireClosed?: boolean } = {}): fc.Arbitrary<ApplyPolicyInput> {
  const ruleSetArb = fc.set(
    fc.record({
      bucket: fc.string({ minLength: 3, maxLength: 12, charSet: "abcdefghijklmnopqrstuvwxyz" }),
      weight: fc.integer({ min: 1, max: 10_000 }),
    }),
    {
      minLength: options.requireClosed ? 2 : 1,
      maxLength: 6,
      compare: (a, b) => a.bucket === b.bucket,
    },
  );

  return fc
    .tuple(
      fc.integer({ min: 0, max: 1_000_000 }),
      fc.uuid(),
      fc.string({ minLength: 1, maxLength: 6, charSet: "abcdefghijklmnopqrstuvwxyz0123456789" }),
      ruleSetArb,
    )
    .chain(([amountCents, policyId, version, rules]) =>
      fc.array(fc.boolean(), { minLength: rules.length, maxLength: rules.length }).map((gates) => {
        const gateAssignments = [...gates];
        if (!gateAssignments.some((gate) => gate)) {
          gateAssignments[0] = true;
        }
        if (options.requireClosed && rules.length > 1 && !gateAssignments.some((gate) => !gate)) {
          gateAssignments[1] = false;
        }

        return {
          bankLine: {
            amountCents,
            currency: "AUD" as const,
          },
          ruleset: {
            id: policyId,
            version,
            rules,
          },
          accountStates: rules.map((rule, index) => ({
            bucket: rule.bucket,
            gate: gateAssignments[index] ? "OPEN" : "CLOSED",
          })),
        } satisfies ApplyPolicyInput;
      }),
    );
}

describe("policy engine", () => {
  it("conserves funds and produces non-negative allocations", () => {
    fc.assert(
      fc.property(policyInputArb(), (input) => {
        const result = applyPolicy(input);
        const totalAllocated = result.allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
        assert.equal(totalAllocated, input.bankLine.amountCents);
        for (const allocation of result.allocations) {
          assert.ok(allocation.amountCents >= 0);
        }
      }),
      { numRuns: 10_000 },
    );
  });

  it("omits allocations for closed buckets", () => {
    fc.assert(
      fc.property(policyInputArb({ requireClosed: true }), (input) => {
        const result = applyPolicy(input);
        const closedBuckets = new Set(
          input.accountStates.filter((state) => state.gate === "CLOSED").map((state) => state.bucket),
        );
        for (const allocation of result.allocations) {
          assert.ok(!closedBuckets.has(allocation.bucket));
        }
      }),
      { numRuns: 10_000 },
    );
  });
});
