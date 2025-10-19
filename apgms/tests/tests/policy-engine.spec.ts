import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

import {
  computeDeterministicAllocation,
  AllocationError,
} from "../../shared/src/policy-engine";
import {
  buildApp,
  InMemoryLedger,
} from "../../services/api-gateway/src/index";

const gateStateArb = fc.constantFrom("open", "closed", "suspended");

const gateArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  state: gateStateArb,
  weight: fc.integer({ min: 0, max: 20 }),
});

const allocationRequestArb = fc.record({
  amount: fc.integer({ min: 0, max: 100_000 }),
  gates: fc.array(gateArb, { minLength: 1, maxLength: 8 }),
});

const validAllocationRequestArb = allocationRequestArb.filter(
  (request) =>
    request.amount === 0 ||
    request.gates.some((gate) => gate.state === "open" && gate.weight > 0),
);

describe("policy engine", () => {
  it("is deterministic, conserves amount, and respects invariants", async () => {
    await fc.assert(
      fc.asyncProperty(validAllocationRequestArb, async (request) => {
        const allocationA = computeDeterministicAllocation(request);
        const allocationB = computeDeterministicAllocation({ ...request });

        expect(allocationA).toEqual(allocationB);

        const totalAllocated = allocationA.allocations.reduce(
          (sum, record) => sum + record.amount,
          0,
        );
        expect(totalAllocated).toBe(request.amount);

        for (const record of allocationA.allocations) {
          expect(record.amount).toBeGreaterThanOrEqual(0);
          const gate = request.gates.find((g) => g.id === record.gateId);
          if (!gate || gate.state !== "open" || gate.weight === 0) {
            expect(record.amount).toBe(0);
          }
        }
      }),
      { numRuns: 10_000 },
    );
  });

  it("throws when amount is positive and no open gates are available", () => {
    const request = {
      amount: 42,
      gates: [
        { id: "a", state: "closed" as const, weight: 10 },
        { id: "b", state: "suspended" as const, weight: 0 },
      ],
    };
    expect(() => computeDeterministicAllocation(request)).toThrow(AllocationError);
  });
});

describe("allocation routes", () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it("previews allocations deterministically", async () => {
    process.env.NODE_ENV = "test";
    const ledger = new InMemoryLedger();
    const app = await buildApp({
      fastifyOptions: { logger: false },
      ledger,
    });

    const payload = {
      orgId: "org-1",
      amount: 100,
      gates: [
        { id: "ops", state: "open" as const, weight: 1 },
        { id: "rnd", state: "open" as const, weight: 1 },
        { id: "compliance", state: "closed" as const, weight: 5 },
      ],
    };

    try {
      const response = await app.inject({
        method: "POST",
        url: "/allocations/preview",
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.amount).toBe(payload.amount);
      expect(body.allocations).toEqual([
        { gateId: "compliance", amount: 0, state: "closed" },
        { gateId: "ops", amount: 50, state: "open" },
        { gateId: "rnd", amount: 50, state: "open" },
      ]);
    } finally {
      await app.close();
    }
  });

  it("applies allocations and records ledger entries", async () => {
    process.env.NODE_ENV = "test";
    const ledger = new InMemoryLedger();
    const app = await buildApp({
      fastifyOptions: { logger: false },
      ledger,
    });

    const payload = {
      orgId: "org-2",
      amount: 101,
      gates: [
        { id: "ops", state: "open" as const, weight: 1 },
        { id: "rnd", state: "open" as const, weight: 1 },
        { id: "finance", state: "open" as const, weight: 1 },
      ],
    };

    try {
      const response = await app.inject({
        method: "POST",
        url: "/allocations/apply",
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      const ledgerEntries = body.ledgerEntries;
      expect(Array.isArray(ledgerEntries)).toBe(true);
      expect(ledgerEntries.length).toBeGreaterThan(0);

      const saved = ledger.getAll();
      expect(saved.length).toBe(ledgerEntries.length);
      expect(saved.every((entry) => entry.orgId === payload.orgId)).toBe(true);
      const totalAllocated = body.allocations.reduce(
        (sum: number, record: { amount: number }) => sum + record.amount,
        0,
      );
      expect(totalAllocated).toBe(payload.amount);
    } finally {
      await app.close();
    }
  });
});
