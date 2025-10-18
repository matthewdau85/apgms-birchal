import * as fc from "../lib/fast-check/index";
import { describe, expect, test } from "../lib/vitest/index";
import { PolicyEngine, defaultPolicies } from "@apgms/shared";

describe("policy engine invariants", () => {
  const engine = new PolicyEngine(defaultPolicies);

  test("deterministic evaluation for identical context", async () => {
    await fc.assert(
      fc.property(
        fc.record({
          amount: fc.integer({ min: -1_000_000, max: 1_000_000 }),
          ledgerBalance: fc.integer({ min: 0, max: 10_000_000 }),
        }),
        ({ amount, ledgerBalance }) => {
          const context = {
            actor: "svc",
            actorOrgId: "org-1",
            orgId: "org-1",
            amount,
            ledgerBalance,
            roles: ["finance:write"],
          } as const;

          const first = engine.evaluate("bank-line:create", context);
          const second = engine.evaluate("bank-line:create", context);

          expect(second.decision).toBe(first.decision);
          expect(second.invariantViolations).toEqual(first.invariantViolations);
        },
      ),
      { verbose: true },
    );
  });

  test("non-negative ledger invariant holds when policy allows", async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        (ledgerBalance, amount) => {
          const context = {
            actor: "svc",
            actorOrgId: "org-1",
            orgId: "org-1",
            amount,
            ledgerBalance,
            roles: ["finance:write"],
          } as const;

          const evaluation = engine.evaluate("bank-line:create", context);
          if (evaluation.decision === "allow") {
            expect(ledgerBalance + amount).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { verbose: true },
    );
  });

  test("negative amounts are always denied", async () => {
    await fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: -1 }), (amount) => {
        const context = {
          actor: "svc",
          actorOrgId: "org-1",
          orgId: "org-1",
          amount,
          ledgerBalance: 10_000,
          roles: ["finance:write"],
        } as const;

        const evaluation = engine.evaluate("bank-line:create", context);
        expect(evaluation.decision).toBe("deny");
      }),
      { verbose: true },
    );
  });
});
