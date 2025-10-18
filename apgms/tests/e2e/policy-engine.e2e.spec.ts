import { test, expect } from "@playwright/test";
import {
  PolicyEngine,
  type ContributionInput,
  type PolicyDefinition,
} from "@apgms/shared/policy-engine";

test.describe("Policy engine lifecycle", () => {
  test("ingest→allocate→RPT→gate→remit→audit verify", async () => {
    const contributions: ContributionInput[] = [
      { id: "c-001", amount: 900, riskScore: 0.1 },
      { id: "c-002", amount: 400, riskScore: 0.25 },
      { id: "c-003", amount: 300, riskScore: 0.4 },
      { id: "discard", amount: -25, riskScore: 0.9 },
    ];

    const policies: PolicyDefinition[] = [
      {
        id: "impact",
        weight: 2,
        cap: 1_000,
        floor: 500,
        gate: { type: "maxAverageRisk", threshold: 0.35 },
      },
      {
        id: "operational",
        weight: 1,
        cap: 900,
        gate: { type: "maxSingleRisk", threshold: 0.45 },
      },
      {
        id: "expansion",
        weight: 1,
        cap: 700,
        gate: { type: "minTotal", threshold: 1_800 },
      },
    ];

    const engine = new PolicyEngine(policies);

    const ingested = await test.step("ingest", async () => {
      const result = engine.ingest(contributions);
      expect(result).toHaveLength(3);
      expect(result.every((entry) => entry.amount > 0)).toBe(true);
      return result;
    });

    const allocation = await test.step("allocate", async () => {
      const outcome = engine.allocate(ingested);
      const allocatedTotal = outcome.allocations.reduce((sum, item) => sum + item.amount, 0);
      const expectedTotal = ingested.reduce((sum, item) => sum + item.amount, 0) - outcome.leftover;
      expect(allocatedTotal).toBeCloseTo(expectedTotal, 6);
      expect(outcome.allocations.length).toBeGreaterThan(0);
      return outcome;
    });

    const requests = await test.step("RPT", async () => {
      const generated = engine.createRequests(allocation.allocations);
      const uniqueIds = new Set(generated.map((req) => req.requestId));
      expect(uniqueIds.size).toBe(generated.length);
      return generated;
    });

    const gateResult = await test.step("gate", async () => {
      const outcome = engine.gate(requests, ingested, allocation.leftover);
      expect(outcome.context.totalAmount).toBeCloseTo(
        ingested.reduce((sum, item) => sum + item.amount, 0),
        6,
      );
      expect(outcome.rejected).toHaveLength(1);
      expect(outcome.rejected[0]?.policyId).toBe("expansion");
      return outcome;
    });

    const remittances = await test.step("remit", async () => {
      const instructions = engine.remit(gateResult.approved);
      expect(instructions).toHaveLength(gateResult.approved.length);
      expect(instructions.every((item) => item.amount > 0)).toBe(true);
      return instructions;
    });

    await test.step("audit", async () => {
      const report = engine.audit({
        contributions: ingested,
        allocations: allocation.allocations,
        remittances,
        unallocated: allocation.leftover,
        gate: gateResult,
      });

      const remittedTotal = remittances.reduce((sum, item) => sum + item.amount, 0);
      const expectedLeftover = gateResult.rejectedTotal + allocation.leftover;
      const totalIn = ingested.reduce((sum, item) => sum + item.amount, 0);

      expect(report.ok).toBe(true);
      expect(report.totals.remitted).toBeCloseTo(remittedTotal, 6);
      expect(report.totals.leftover).toBeCloseTo(expectedLeftover, 6);
      expect(report.totals.input).toBeCloseTo(totalIn, 6);
      expect(report.issues).toHaveLength(0);
    });
  });
});
