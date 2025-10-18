import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { previewAllocations } from "@apgms/policy-engine";

type PercentageAllocation = {
  destinationAccountId: string;
  percentageBasisPoints: number;
};

const amountArb = fc.integer({ min: 0, max: 500_000_000 });

const percentageAllocationsArb = fc
  .array(
    fc.record({
      destinationAccountId: fc.uuidV4(),
      weight: fc.integer({ min: 1, max: 10_000 }),
    }),
    { minLength: 1, maxLength: 6 }
  )
  .map((entries) => {
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let remainingBasisPoints = 10_000;

    return entries.map((entry, index) => {
      const basisPoints =
        index === entries.length - 1
          ? remainingBasisPoints
          : Math.max(
              0,
              Math.min(
                remainingBasisPoints,
                Math.floor((entry.weight * 10_000) / totalWeight)
              )
            );

      remainingBasisPoints -= basisPoints;

      return {
        destinationAccountId: entry.destinationAccountId,
        percentageBasisPoints: basisPoints,
      } satisfies PercentageAllocation;
    });
  })
  .filter((allocations) =>
    allocations.some((allocation) => allocation.percentageBasisPoints > 0)
  );

const rulesetArb = fc.array(
  fc.record({
    id: fc.uuidV4(),
    allocations: percentageAllocationsArb,
  }),
  { minLength: 1, maxLength: 4 }
);

test("previewAllocations conserves amountCents and never allocates negative values", async () => {
  await fc.assert(
    fc.asyncProperty(amountArb, rulesetArb, async (amountCents, rulesets) => {
      const preview = await previewAllocations({
        amountCents,
        rulesets: rulesets.map((ruleset) => ({
          id: ruleset.id,
          allocations: ruleset.allocations.map((allocation) => ({
            type: "percentage",
            percentageBasisPoints: allocation.percentageBasisPoints,
            destinationAccountId: allocation.destinationAccountId,
          })),
        })),
      } as any);

      const allocations = Array.isArray(preview)
        ? preview
        : preview.allocations ?? [];

      assert.ok(
        Array.isArray(allocations),
        "previewAllocations should return an array of allocations or an object with an allocations array"
      );

      const totalAllocated = allocations.reduce((sum, allocation) => {
        assert.ok(
          typeof allocation.amountCents === "number",
          "each allocation should expose amountCents"
        );
        assert.ok(
          allocation.amountCents >= 0,
          "allocated cents must never be negative"
        );
        return sum + allocation.amountCents;
      }, 0);

      assert.equal(
        totalAllocated,
        amountCents,
        "allocation preview must conserve the original amount"
      );
    }),
    { numRuns: 10_000 }
  );
});
