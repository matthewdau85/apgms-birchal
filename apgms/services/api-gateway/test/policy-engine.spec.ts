import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { allocate } from "@apgms/policy-engine";

test("allocations conserve value and remain non-negative", () => {
  const amountArb = fc.integer({ min: 0, max: 1_000_000 });
  const bucketNameArb = fc.string({ minLength: 1, maxLength: 10, charSet: "abcdefghijklmnopqrstuvwxyz" });
  const allocationArb = fc.record({
    bucket: bucketNameArb,
    weight: fc.integer({ min: 0, max: 10 }),
    minCents: fc.option(fc.integer({ min: 0, max: 5_000 }), { nil: undefined }),
  }).map((record) => ({ ...record, minCents: record.minCents ?? undefined }));

  const rulesetArb = fc.record({
    strategy: fc.constantFrom("proportional", "flat"),
    allocations: fc.array(allocationArb, { minLength: 1, maxLength: 5 }),
    gates: fc.array(bucketNameArb, { minLength: 0, maxLength: 3 }),
    noRemittanceBucket: bucketNameArb,
  });

  fc.assert(
    fc.property(amountArb, rulesetArb, fc.boolean(), (amountCents, ruleset, closedGate) => {
      const gateStates = ruleset.gates.map((gateId, index) => ({
        id: gateId,
        state: closedGate && index === 0 ? "CLOSED" : "OPEN",
      }));

      const result = allocate({
        bankLine: {
          id: "bank-line",
          orgId: "org",
          amountCents,
          currency: "AUD",
        },
        ruleset,
        accountStates: { gates: gateStates },
      });

      const total = result.allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
      assert.equal(total, amountCents);
      for (const allocation of result.allocations) {
        assert.ok(allocation.amountCents >= 0, "allocation must be non-negative");
      }
      if (closedGate && ruleset.gates.length > 0) {
        assert.equal(result.explain.noRemittance, true);
        assert.equal(result.allocations.length, 1);
        assert.equal(result.allocations[0].amountCents, amountCents);
      }

      const repeat = allocate({
        bankLine: {
          id: "bank-line",
          orgId: "org",
          amountCents,
          currency: "AUD",
        },
        ruleset,
        accountStates: { gates: gateStates },
      });
      assert.deepEqual(repeat, result);
    }),
    { numRuns: 10_000 }
  );
});

test("rounding adjustments maintain conservation", () => {
  const fixedRuleset = {
    strategy: "proportional" as const,
    allocations: [
      { bucket: "ops", weight: 1 },
      { bucket: "savings", weight: 1 },
      { bucket: "tax", weight: 1 },
    ],
    gates: [],
    noRemittanceBucket: "hold",
  };

  fc.assert(
    fc.property(fc.integer({ min: 0, max: 10_000 }), (amountCents) => {
      const result = allocate({
        bankLine: { id: "line", orgId: "org", amountCents, currency: "AUD" },
        ruleset: fixedRuleset,
        accountStates: {},
      });
      const total = result.allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
      assert.equal(total, amountCents);
    }),
    { numRuns: 10_000 }
  );
});
