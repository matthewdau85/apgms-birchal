import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AnomalyRuleEngine,
  CandidateTransaction,
  DetectionContext,
  createRuleEngine,
  defaultAnomalyRules,
} from "../../../policy/anomalies";

const baseCandidate: CandidateTransaction = {
  id: "txn-1",
  orgId: "org-1",
  amount: 12_500,
  occurredAt: new Date("2024-01-01T10:00:00Z"),
  payee: "Acme Corp",
  description: "Consulting",
};

describe("policy/anomalies", () => {
  it("triggers configurable threshold rule", () => {
    const engine = createRuleEngine(defaultAnomalyRules, [
      { id: "large-amount", options: { threshold: 5_000 }, summary: "Large payment" },
    ]);
    const results = engine.evaluate(baseCandidate, {});
    assert.equal(results.length, 1);
    assert.equal(results[0]?.ruleId, "large-amount");
    assert.equal(results[0]?.summary, "Large payment");
    assert.equal(results[0]?.severity, "HIGH");
    assert.ok(results[0]?.message?.includes("12500"));
  });

  it("merges contextual watchlists with configuration", () => {
    const engine = new AnomalyRuleEngine(defaultAnomalyRules, [
      { id: "watchlist-payee", options: { watchlist: ["Acme Corp"] } },
    ]);
    const context: DetectionContext = {
      watchlist: ["Bad Actors"],
    };
    const configured = engine.evaluate(baseCandidate, context);
    assert.equal(configured.length, 1);
    assert.equal(configured[0]?.ruleId, "watchlist-payee");

    const contextOnlyCandidate = { ...baseCandidate, id: "txn-2", payee: "Bad Actors" };
    const contextual = engine.evaluate(contextOnlyCandidate, context);
    assert.equal(contextual.length, 1);
    assert.equal(contextual[0]?.ruleId, "watchlist-payee");
    assert.equal(contextual[0]?.severity, "CRITICAL");
  });

  it("respects disabled rules in configuration", () => {
    const engine = createRuleEngine(defaultAnomalyRules, [
      { id: "large-amount", enabled: false },
    ]);
    const results = engine.evaluate(baseCandidate, {});
    assert.equal(results.length, 0);
  });

  it("detects rapid repeat activity within the configured window", () => {
    const context: DetectionContext = {
      recentTransactions: [
        { ...baseCandidate, id: "txn-0", occurredAt: new Date("2024-01-01T09:15:00Z") },
        { ...baseCandidate, id: "txn-00", occurredAt: new Date("2024-01-01T09:45:00Z") },
        { ...baseCandidate, id: "txn-000", occurredAt: new Date("2024-01-01T09:50:00Z") },
      ],
    };
    const engine = createRuleEngine(defaultAnomalyRules, [
      { id: "rapid-repeat", options: { windowMinutes: 90, maxPerPayee: 3 } },
    ]);
    const results = engine.evaluate(baseCandidate, context);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.ruleId, "rapid-repeat");
    assert.equal(results[0]?.metadata?.count, 4);
  });

  it("falls back to baseline deviation rule when defaults apply", () => {
    const candidate: CandidateTransaction = {
      ...baseCandidate,
      amount: 30_000,
      payee: "Future Goods",
    };
    const context: DetectionContext = {
      baselines: {
        "Future Goods": { average: 4_000 },
      },
    };
    const engine = createRuleEngine();
    const results = engine.evaluate(candidate, context);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.ruleId, "average-deviation");
    assert.equal(results[0]?.severity, "MEDIUM");
    assert.ok(results[0]?.message?.includes("average"));
  });
});
