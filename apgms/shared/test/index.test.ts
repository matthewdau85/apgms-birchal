import assert from "node:assert";
import fc from "fast-check";

import { evaluatePolicy } from "../policy-engine/index";

const ruleArbitrary = fc.record({
  accountId: fc.string({ minLength: 1, maxLength: 8 }),
  weight: fc.integer({ min: 0, max: 100 }),
  gate: fc.constantFrom("OPEN", "CLOSED" as const),
  label: fc.option(fc.string({ minLength: 1, maxLength: 12 }), {
    nil: undefined,
  }),
});

const bankLineArbitrary = fc.record({
  id: fc.uuid(),
  orgId: fc.uuid(),
  date: fc.date().map((date) => date.toISOString()),
  amount: fc.integer({ min: 0, max: 1_000_00 }).map((value) => value / 100),
  payee: fc.string({ minLength: 1, maxLength: 12 }),
  desc: fc.string({ minLength: 1, maxLength: 24 }),
});

const accountStateArbitrary = fc.record({
  accountId: fc.string({ minLength: 1, maxLength: 8 }),
  balance: fc.integer({ min: 0, max: 1_000_00 }).map((value) => value / 100),
});

async function runPolicyInvariants(): Promise<void> {
  await fc.assert(
    fc.asyncProperty(
      bankLineArbitrary,
      fc
        .array(ruleArbitrary, { minLength: 1, maxLength: 5 })
        .map((rules) => {
          if (!rules.some((rule) => rule.gate === "OPEN" && rule.weight > 0)) {
            return [
              { ...rules[0], gate: "OPEN" as const, weight: Math.max(1, rules[0].weight) },
              ...rules.slice(1),
            ];
          }
          return rules;
        }),
      fc.array(accountStateArbitrary, { maxLength: 5 }),
      async (bankLine, rules, accountStates) => {
        const evaluated = evaluatePolicy({
          bankLine,
          ruleset: {
            id: "ruleset-1",
            name: "default",
            version: "v1",
            rules,
          },
          accountStates,
        });

        const total = evaluated.allocations.reduce(
          (sum, allocation) => sum + allocation.amount,
          0,
        );
        assert.ok(
          Math.abs(total - bankLine.amount) < 0.005,
          `conservation failed: ${total} !== ${bankLine.amount}`,
        );

        evaluated.allocations.forEach((allocation) => {
          assert.ok(
            allocation.amount >= 0,
            `allocation negative for ${allocation.accountId}`,
          );
        });

        const closedAccounts = new Set(
          rules.filter((rule) => rule.gate === "CLOSED").map((rule) => rule.accountId),
        );

        evaluated.allocations.forEach((allocation) => {
          if (closedAccounts.has(allocation.accountId)) {
            assert.strictEqual(
              allocation.amount,
              0,
              `closed gate allocated value for ${allocation.accountId}`,
            );
          }
        });
      },
    ),
    { numRuns: 50 },
  );
}

runPolicyInvariants()
  .then(() => {
    console.log("policy engine invariants satisfied");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
