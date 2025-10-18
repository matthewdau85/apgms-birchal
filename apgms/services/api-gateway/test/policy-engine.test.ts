import assert from "node:assert";
import { test } from "node:test";
import { randomInt } from "node:crypto";
import { evaluatePolicy } from "../src/policy-engine.js";

test("policy engine invariants hold across random inputs", () => {
  const iterations = 10_000;

  for (let i = 0; i < iterations; i += 1) {
    const accountCount = randomInt(1, 6);
    const accounts = Array.from({ length: accountCount }).map((_, idx) => ({
      id: `acct-${idx}`,
      balance: randomInt(0, 1_000),
    }));

    const txCount = randomInt(1, 10);
    const transactions = Array.from({ length: txCount }).map(() => ({
      accountId: `acct-${randomInt(0, accountCount)}`,
      delta: randomInt(0, 400) - 200,
    }));

    const input = { accounts, transactions };
    const result = evaluatePolicy(input);
    const again = evaluatePolicy(input);

    assert.deepStrictEqual(result, again, "evaluation should be deterministic");

    for (const account of result.accounts) {
      assert.ok(account.balance >= 0, "balances must remain non-negative");
    }

    const rejectedSet = new Set(result.rejected);
    let acceptedDelta = 0;
    for (const tx of transactions) {
      if (!rejectedSet.has(tx)) {
        acceptedDelta += tx.delta;
      }
    }

    const totalDiff = result.totalAfter - result.totalBefore;
    assert.strictEqual(totalDiff, acceptedDelta);
  }
});
