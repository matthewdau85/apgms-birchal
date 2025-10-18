import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';

import { applyPolicy, type GateState } from '@apgms/shared/policy-engine';

type ArbitraryAccountState = Parameters<typeof applyPolicy>[0]['accountStates'][number];

const gateArb = fc.constantFrom<GateState>('OPEN', 'CLOSED');
const weightArb = fc.double({ min: 0, max: 10_000, noNaN: true, noDefaultInfinity: true });

const accountStateArb = fc.record({
  accountId: fc.hexaString({ minLength: 1, maxLength: 16 }),
  gate: fc.option(gateArb, { nil: undefined }),
  weight: fc.option(weightArb, { nil: undefined }),
}) as fc.Arbitrary<ArbitraryAccountState>;

const uniqueAccountStatesArb = fc.uniqueArray(accountStateArb, {
  minLength: 0,
  maxLength: 12,
  selector: (account) => account.accountId,
});

const bankLineArb = fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true });

const propertyOptions = { numRuns: 10_000 } as const;

test('applyPolicy conserves the bank line', async () => {
  await fc.assert(
    fc.property(bankLineArb, uniqueAccountStatesArb, (bankLine, accountStates) => {
      const result = applyPolicy({ bankLine, ruleset: [], accountStates });
      const total = result.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
      const openAccounts = accountStates.filter((account) => account.gate !== 'CLOSED');
      const expected = openAccounts.length > 0 && Number.isFinite(bankLine) && bankLine > 0 ? bankLine : 0;
      assert.ok(
        Math.abs(total - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-12),
        `total allocation ${total} does not conserve bank line ${expected}`,
      );
    }),
    propertyOptions,
  );
});

test('applyPolicy never allocates negative amounts', async () => {
  await fc.assert(
    fc.property(bankLineArb, uniqueAccountStatesArb, (bankLine, accountStates) => {
      const result = applyPolicy({ bankLine, ruleset: [], accountStates });

      for (const allocation of result.allocations) {
        assert.ok(
          allocation.amount >= -1e-9,
          `allocation for ${allocation.accountId} is negative: ${allocation.amount}`,
        );
      }
    }),
    propertyOptions,
  );
});

test('applyPolicy keeps gates closed', () => {
  const result = applyPolicy({
    bankLine: 1_000,
    ruleset: [],
    accountStates: [
      { accountId: 'open-1', gate: 'OPEN' },
      { accountId: 'closed-1', gate: 'CLOSED' },
    ],
  });

  const closedAllocation = result.allocations.find((allocation) => allocation.accountId === 'closed-1');
  assert.ok(closedAllocation);
  assert.strictEqual(closedAllocation.amount, 0);
});
