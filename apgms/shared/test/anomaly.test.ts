import assert from "node:assert/strict";
import test from "node:test";

import { AnomalyEngine } from "../src/anomaly/engine";
import { anomalyFixtures } from "./fixtures/transactions";

test("rules emit counter examples and control false positives", () => {
  const engine = new AnomalyEngine();
  const workingHistory = [...anomalyFixtures.history];
  let falsePositives = 0;
  let normalEvaluations = 0;

  for (const entry of anomalyFixtures.stream) {
    workingHistory.sort((a, b) => a.date.getTime() - b.date.getTime());
    const findings = engine.evaluate(entry.transaction, workingHistory, {
      policy: anomalyFixtures.policy,
    });
    const actualRuleIds = findings.map((finding) => finding.ruleId).sort();
    const expectedRuleIds = [...entry.expectedRules].sort();

    for (const finding of findings) {
      assert.ok(
        finding.counterExamples.length > 0,
        `${finding.ruleId} should include at least one counter example`
      );
    }

    for (const expected of expectedRuleIds) {
      assert.ok(
        actualRuleIds.includes(expected),
        `${entry.note} should trigger ${expected}`
      );
    }

    if (expectedRuleIds.length === 0) {
      normalEvaluations += 1;
      if (actualRuleIds.length > 0) {
        falsePositives += 1;
      }
    } else {
      assert.ok(
        actualRuleIds.length >= expectedRuleIds.length,
        `${entry.note} expected at least ${expectedRuleIds.length} rules`
      );
    }

    workingHistory.push(entry.transaction);
  }

  assert.ok(normalEvaluations > 0, "fixtures should include normal traffic");
  const falsePositiveRate = falsePositives / normalEvaluations;
  assert.ok(
    falsePositiveRate <= 0.2,
    `false positive rate ${falsePositiveRate.toFixed(2)} exceeds threshold`
  );
});
