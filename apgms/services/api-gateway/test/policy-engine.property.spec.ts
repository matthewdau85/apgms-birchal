import fc from "fast-check";
import { describe, it, expect } from "vitest";

const policyEngineModule: any = (() => {
  try {
    return require("../src/policy-engine");
  } catch (error) {
    throw new Error("Expected ../src/policy-engine to be resolvable for property tests");
  }
})();

const previewAllocations: any =
  policyEngineModule?.previewAllocations ??
  policyEngineModule?.preview ??
  policyEngineModule?.default?.previewAllocations;

if (typeof previewAllocations !== "function") {
  throw new Error("previewAllocations export not found in policy engine module");
}

type SimpleRuleLeaf = {
  id: string;
  shareBps: number;
  percentage: number;
  weight: number;
  type: string;
  allocation: {
    shareBps: number;
    percentage: number;
    weight: number;
    type: string;
  };
  target: {
    type: string;
    accountId: string;
  };
  accountId: string;
  children: SimpleRuleLeaf[];
  splits: SimpleRuleLeaf[];
  rules: SimpleRuleLeaf[];
};

type SimpleRuleSet = {
  id: string;
  type: string;
  shareBps: number;
  percentage: number;
  weight: number;
  allocation: {
    shareBps: number;
    percentage: number;
    weight: number;
    type: string;
  };
  children: SimpleRuleLeaf[];
  splits: SimpleRuleLeaf[];
  rules: SimpleRuleLeaf[];
};

const simpleRuleSetArb = fc
  .array(fc.integer({ min: 0, max: 10_000 }), { minLength: 1, maxLength: 8 })
  .map((weights) => {
    const normalized = [...weights];
    if (!normalized.some((value) => value > 0)) {
      normalized[0] = 1;
    }
    const totalWeight = normalized.reduce((sum, value) => sum + value, 0);

    let remainder = 10_000;
    const leaves: SimpleRuleLeaf[] = normalized.map((weight, index, array) => {
      const proportionalShare = Math.floor((weight * 10_000) / totalWeight);
      const shareBps = index === array.length - 1 ? remainder : proportionalShare;
      remainder -= shareBps;

      const percentage = shareBps / 100;
      const node: SimpleRuleLeaf = {
        id: `leaf-${index}`,
        shareBps,
        percentage,
        weight: shareBps,
        type: "allocation",
        allocation: {
          shareBps,
          percentage,
          weight: shareBps,
          type: "allocation",
        },
        target: {
          type: "account",
          accountId: `acct-${index}`,
        },
        accountId: `acct-${index}`,
        children: [],
        splits: [],
        rules: [],
      };

      return node;
    });

    const root: SimpleRuleSet = {
      id: "root",
      type: "split",
      shareBps: 10_000,
      percentage: 100,
      weight: 10_000,
      allocation: {
        shareBps: 10_000,
        percentage: 100,
        weight: 10_000,
        type: "split",
      },
      children: leaves,
      splits: leaves,
      rules: leaves,
    };

    return root;
  });

function attemptPreview(amountCents: number, ruleset: SimpleRuleSet) {
  const attempts = [
    () => previewAllocations(amountCents, ruleset),
    () => previewAllocations({ amountCents, ruleset }),
    () => previewAllocations({ amountCents, rules: ruleset }),
    () => previewAllocations({ amountCents, policy: ruleset }),
    () => previewAllocations(ruleset, amountCents),
    () => previewAllocations({ policy: ruleset, amountCents }),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const result = attempt();
      if (result !== undefined) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Unable to obtain preview allocations result");
}

function extractAllocations(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (Array.isArray(result?.allocations)) {
    return result.allocations;
  }
  if (Array.isArray(result?.allocation)) {
    return result.allocation;
  }
  if (Array.isArray(result?.preview)) {
    return result.preview;
  }
  if (Array.isArray(result?.entries)) {
    return result.entries;
  }
  throw new Error("previewAllocations result did not contain an allocations collection");
}

function readAmountCents(allocation: any): number {
  const candidates = [
    allocation?.amountCents,
    allocation?.cents,
    allocation?.amount,
    allocation?.value,
    allocation?.allocation?.amountCents,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  throw new Error("Allocation object does not expose a numeric amount");
}

describe("policy-engine preview allocations", () => {
  it("conserves total amount and keeps allocations non-negative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000_000 }),
        simpleRuleSetArb,
        (amountCents, ruleset) => {
          const preview = attemptPreview(amountCents, ruleset);
          const allocations = extractAllocations(preview);

          expect(allocations.length).toBeGreaterThan(0);

          let total = 0;
          for (const allocation of allocations) {
            const value = Math.trunc(readAmountCents(allocation));
            expect(value).toBeGreaterThanOrEqual(0);
            total += value;
          }

          expect(total).toBe(amountCents);
        }
      ),
      { numRuns: 10000 }
    );
  });
});
