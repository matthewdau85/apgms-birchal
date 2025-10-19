import fc from 'fast-check';
import {
  applyPolicy,
  bankersRound,
  type AccountState,
  type ApplyPolicyInput,
  type PolicyBucketRule,
  type PolicyRuleset,
} from '@apgms/policy-engine';

type GateState = 'OPEN' | 'CLOSED';

const RUNS = 10_000;

const gateArb = fc.constantFrom<GateState>('OPEN', 'CLOSED');

const corridorArb = fc
  .tuple(fc.integer({ min: 0, max: 10_000 }), fc.integer({ min: 0, max: 10_000 }))
  .map(([a, b]) => ({
    minBps: Math.min(a, b),
    maxBps: Math.max(a, b),
  }));

const allowListArb = fc.option(
  fc.set(fc.hexaString({ minLength: 2, maxLength: 6 }), { minLength: 1, maxLength: 4 }),
  { nil: undefined },
);

const denyListArb = fc.option(
  fc.set(fc.hexaString({ minLength: 2, maxLength: 6 }), { minLength: 1, maxLength: 4 }),
  { nil: undefined },
);

const bucketRuleArb = fc
  .record({
    bucketId: fc.hexaString({ minLength: 3, maxLength: 8 }),
    corridor: corridorArb,
    counterpartyAllow: allowListArb,
    counterpartyDeny: denyListArb,
    gate: fc.option(gateArb, { nil: undefined }),
  })
  .map((rule) => ({
    ...rule,
    corridor: {
      minBps: rule.corridor.minBps,
      maxBps: Math.max(rule.corridor.minBps, rule.corridor.maxBps),
    },
  } satisfies PolicyBucketRule));

const rulesetArb = fc.set(bucketRuleArb, {
  minLength: 1,
  maxLength: 4,
  compare: (a, b) => a.bucketId === b.bucketId,
});

const accountStatesArb = (bucketIds: string[]) =>
  fc.set(
    fc.record({
      accountId: fc.hexaString({ minLength: 4, maxLength: 10 }),
      bucketId: fc.constantFrom(...bucketIds),
      requestedCents: fc.bigUintN(40).map((value) => BigInt(value)),
      counterpartyId: fc.hexaString({ minLength: 3, maxLength: 8 }),
      gate: fc.option(gateArb, { nil: undefined }),
    }),
    { minLength: 0, maxLength: 12, compare: (a, b) => a.accountId === b.accountId },
  );

const bankLineArb = fc.record({
  availableCents: fc.bigUintN(44).map((value) => BigInt(value)),
  gate: fc.option(gateArb, { nil: undefined }),
});

const policyInputArb = rulesetArb.chain((bucketRules) => {
  const ruleset: PolicyRuleset = { buckets: bucketRules };
  const buckets = bucketRules.map((rule) => rule.bucketId);
  return fc
    .tuple(bankLineArb, accountStatesArb(buckets))
    .map(([bankLine, accountStates]) => ({
      bankLine,
      ruleset,
      accountStates,
    } satisfies ApplyPolicyInput));
});

function computeEligibleRequests(
  rule: PolicyBucketRule,
  accounts: AccountState[],
  bankLineGate: GateState,
): bigint {
  if ((rule.gate ?? 'OPEN') === 'CLOSED' || bankLineGate === 'CLOSED') {
    return 0n;
  }
  return accounts.reduce<bigint>((total, account) => {
    if ((account.gate ?? 'OPEN') === 'CLOSED') {
      return total;
    }
    if (rule.counterpartyAllow && rule.counterpartyAllow.length > 0 && !rule.counterpartyAllow.includes(account.counterpartyId)) {
      return total;
    }
    if (rule.counterpartyDeny && rule.counterpartyDeny.includes(account.counterpartyId)) {
      return total;
    }
    return total + (account.requestedCents < 0n ? 0n : account.requestedCents);
  }, 0n);
}

function groupAllocationsByBucket(result: ReturnType<typeof applyPolicy>) {
  const map = new Map<string, bigint>();
  for (const allocation of result.allocations) {
    map.set(allocation.bucketId, (map.get(allocation.bucketId) ?? 0n) + allocation.allocatedCents);
  }
  return map;
}

fc.assert(
  fc.property(policyInputArb, ({ bankLine, ruleset, accountStates }) => {
    const result = applyPolicy({ bankLine, ruleset, accountStates });
    const totalAllocated = result.allocations.reduce((sum, item) => sum + item.allocatedCents, 0n);
    const eligibleRequested = ruleset.buckets.reduce((sum, bucketRule) => {
      const bucketAccounts = accountStates.filter((account) => account.bucketId === bucketRule.bucketId);
      return sum + computeEligibleRequests(bucketRule, bucketAccounts, bankLine.gate ?? 'OPEN');
    }, 0n);
    if (bankLine.gate === 'CLOSED') {
      return totalAllocated === 0n;
    }
    return totalAllocated <= bankLine.availableCents && totalAllocated <= eligibleRequested;
  }),
  { numRuns: RUNS },
);

fc.assert(
  fc.property(policyInputArb, ({ bankLine, ruleset, accountStates }) => {
    const result = applyPolicy({ bankLine, ruleset, accountStates });
    return result.allocations.every((allocation) => allocation.allocatedCents >= 0n);
  }),
  { numRuns: RUNS },
);

function toComparableAllocations(result: ReturnType<typeof applyPolicy>): string[] {
  return result.allocations.map(
    (allocation) => `${allocation.accountId}:${allocation.bucketId}:${allocation.allocatedCents.toString()}`,
  );
}

fc.assert(
  fc.property(policyInputArb, ({ bankLine, ruleset, accountStates }) => {
    const first = applyPolicy({ bankLine, ruleset, accountStates });
    const second = applyPolicy({ bankLine, ruleset, accountStates });
    return (
      toComparableAllocations(first).join('|') === toComparableAllocations(second).join('|') &&
      first.policyHash === second.policyHash &&
      first.explain === second.explain
    );
  }),
  { numRuns: RUNS },
);

fc.assert(
  fc.property(policyInputArb, ({ bankLine, ruleset, accountStates }) => {
    const result = applyPolicy({ bankLine, ruleset, accountStates });
    const allocationsByBucket = groupAllocationsByBucket(result);
    const total = bankLine.availableCents < 0n ? 0n : bankLine.availableCents;
    const bankLineGate = bankLine.gate ?? 'OPEN';
    const minFeasibleTotal = ruleset.buckets.reduce((sum, bucketRule) => {
      const bucketAccounts = accountStates.filter((account) => account.bucketId === bucketRule.bucketId);
      const requested = computeEligibleRequests(bucketRule, bucketAccounts, bankLineGate);
      const minBound = bankersRound(total * BigInt(bucketRule.corridor.minBps), 10_000n);
      const minRequired = requested >= minBound ? minBound : requested;
      return sum + minRequired;
    }, 0n);
    for (const bucketRule of ruleset.buckets) {
      const bucketAccounts = accountStates.filter((account) => account.bucketId === bucketRule.bucketId);
      const requested = computeEligibleRequests(bucketRule, bucketAccounts, bankLineGate);
      const allocated = allocationsByBucket.get(bucketRule.bucketId) ?? 0n;
      const minBound = bankersRound(total * BigInt(bucketRule.corridor.minBps), 10_000n);
      const maxBound = bankersRound(total * BigInt(bucketRule.corridor.maxBps), 10_000n);
      if (requested < minBound || minFeasibleTotal > total) {
        if (allocated > requested) {
          return false;
        }
      } else if (bankLineGate === 'OPEN') {
        if (allocated < minBound) {
          return false;
        }
      }
      if (allocated > maxBound) {
        return false;
      }
      if (allocated > requested) {
        return false;
      }
    }
    return true;
  }),
  { numRuns: RUNS },
);
