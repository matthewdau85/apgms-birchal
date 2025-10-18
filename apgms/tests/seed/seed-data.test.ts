import { describe, expect, it } from "vitest";
import { PolicyStatus, generateSeedData } from "../../scripts/seed-data";

describe("generateSeedData", () => {
  const data = generateSeedData("test-org");

  it("creates policies with at least one gate", () => {
    expect(data.policies.length).toBeGreaterThan(0);
    const gatePolicyIds = new Set(data.gates.map((gate) => gate.policyId));
    const statuses: PolicyStatus[] = ["ACTIVE", "INACTIVE", "ARCHIVED"];
    data.policies.forEach((policy) => {
      expect(statuses).toContain(policy.status);
      expect(gatePolicyIds.has(policy.id)).toBe(true);
    });
  });

  it("splits bank lines into allocations that sum to the line amount", () => {
    const lineLookup = new Map(data.bankLines.map((line) => [line.id, line]));
    expect(lineLookup.size).toBeGreaterThan(0);

    const allocationsByLine = new Map<string, number>();
    data.allocations.forEach((allocation) => {
      const amount = Number(allocation.amount);
      const existing = allocationsByLine.get(allocation.bankLineId) ?? 0;
      allocationsByLine.set(allocation.bankLineId, Number((existing + amount).toFixed(2)));
    });

    allocationsByLine.forEach((allocatedTotal, bankLineId) => {
      const sourceLine = lineLookup.get(bankLineId);
      expect(sourceLine).toBeDefined();
      const lineAmount = Number(sourceLine!.amount);
      expect(Math.abs(allocatedTotal - lineAmount)).toBeLessThanOrEqual(0.02);
    });
  });

  it("produces audit events tied to known entities", () => {
    expect(data.auditEvents.length).toBeGreaterThan(0);
    const policyIds = new Set(data.policies.map((policy) => policy.id));
    const allocationIds = new Set(data.allocations.map((allocation) => allocation.id));
    const bankLineIds = new Set(data.bankLines.map((line) => line.id));

    const entityCoverage = { policy: 0, allocation: 0, bank_line: 0 };

    data.auditEvents.forEach((event) => {
      switch (event.entityType) {
        case "policy":
          expect(policyIds.has(event.entityId)).toBe(true);
          entityCoverage.policy += 1;
          break;
        case "allocation":
          expect(allocationIds.has(event.entityId)).toBe(true);
          entityCoverage.allocation += 1;
          break;
        case "bank_line":
          expect(bankLineIds.has(event.entityId)).toBe(true);
          entityCoverage.bank_line += 1;
          break;
        default:
          throw new Error(`Unexpected entity type ${event.entityType}`);
      }
    });

    expect(entityCoverage.policy).toBeGreaterThan(0);
    expect(entityCoverage.allocation).toBeGreaterThan(0);
    expect(entityCoverage.bank_line).toBeGreaterThan(0);
  });
});

