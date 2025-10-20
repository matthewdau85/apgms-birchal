import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  evaluatePolicy,
  type PolicyRule,
  type PolicyContext,
  type ReconciliationOutcome,
} from "../../policy/engine";

describe("policy engine", () => {
  it("evaluates rules by priority and stops on first match", () => {
    const rules: PolicyRule[] = [
      {
        id: "fallback-approval",
        priority: 100,
        when: () => true,
        effect: { status: "approved", reason: "fallback" },
      },
      {
        id: "high-risk",
        priority: 10,
        when: (ctx) => Number(ctx.riskScore) > 70,
        effect: { status: "rejected", reason: "risk_score_high" },
      },
      {
        id: "positive-match",
        priority: 20,
        when: (ctx) => Boolean(ctx.matchFound),
        effect: { status: "approved", reason: "match_found" },
      },
    ];

    const context: PolicyContext = { matchFound: true, riskScore: 80 };

    const result = evaluatePolicy(rules, context);

    assert.strictEqual(result.finalOutcome.status, "rejected");
    assert.strictEqual(result.finalOutcome.ruleId, "high-risk");
    assert.deepStrictEqual(result.matchedRules, ["high-risk"]);
    assert.strictEqual(result.outcomes.length, 1);
    assert.strictEqual(result.trace.length, 1);
  });

  it("collects all matches when auditing and surfaces default outcome", () => {
    const rules: PolicyRule[] = [
      {
        id: "manual-review",
        priority: 1,
        when: (ctx) => Number(ctx.discrepancy) > 0,
        effect: (ctx) => ({
          status: "manual_review",
          reason: `discrepancy_${ctx.discrepancy}`,
        }),
        stopOnMatch: false,
      },
      {
        id: "auto-approve",
        priority: 5,
        when: (ctx) => Number(ctx.discrepancy) <= 5,
        effect: { status: "approved", reason: "within_threshold" },
      },
    ];

    const context: PolicyContext = { discrepancy: 2 };

    const result = evaluatePolicy(rules, context, {
      collectAllMatches: true,
      defaultOutcome: { status: "manual_review", reason: "no_rule" },
    });

    const expectedOutcomes: ReconciliationOutcome[] = [
      {
        ruleId: "manual-review",
        status: "manual_review",
        reason: "discrepancy_2",
      },
      {
        ruleId: "auto-approve",
        status: "approved",
        reason: "within_threshold",
      },
    ];

    const simplifiedOutcomes = result.outcomes.map(({ ruleId, status, reason }) => ({
      ruleId,
      status,
      reason,
    }));

    assert.deepStrictEqual(simplifiedOutcomes, expectedOutcomes);
    assert.strictEqual(result.finalOutcome.ruleId, "auto-approve");
    assert.deepStrictEqual(result.matchedRules, ["manual-review", "auto-approve"]);

    const noMatch = evaluatePolicy(rules, {}, {
      defaultOutcome: { status: "approved", reason: "no_discrepancy", ruleId: "custom" },
    });

    assert.deepStrictEqual(noMatch.outcomes, []);
    assert.strictEqual(noMatch.finalOutcome.ruleId, "custom");
    assert.strictEqual(noMatch.finalOutcome.status, "approved");
    assert.strictEqual(noMatch.finalOutcome.reason, "no_discrepancy");
  });
});
