import test from 'node:test';
import assert from 'node:assert/strict';

import { MockRail, TransferRequest } from '../../server/rails/mockRail.js';
import {
  GateScheduler,
  ProcessingSummary,
  ScheduledTransfer,
  createBlockedAccountGate,
  createMaxAmountGate,
} from '../../server/scheduler/gates.js';

const createTransfer = (overrides: Partial<TransferRequest> = {}): TransferRequest => ({
  fromAccountId: 'payer-1',
  toAccountId: 'beneficiary-1',
  amount: 100,
  currency: 'AUD',
  ...overrides,
});

const now = new Date('2024-01-01T00:00:00.000Z');

const createScheduler = () => {
  const rail = new MockRail({ clock: () => now });
  const scheduler = new GateScheduler(rail, {
    clock: () => now,
    gates: [
      createMaxAmountGate(1_000),
      createBlockedAccountGate(['fraudulent-account']),
    ],
  });

  return { rail, scheduler };
};

const process = async (
  scheduler: GateScheduler,
  jobs: ScheduledTransfer[]
): Promise<ProcessingSummary> => {
  jobs.forEach((job) => scheduler.enqueue(job));
  return scheduler.processDueJobs(now);
};

test('GateScheduler settles transfers that pass all gates', async () => {
  const { rail, scheduler } = createScheduler();

  const summary = await process(scheduler, [
    { id: 'job-1', request: createTransfer(), runAt: now },
  ]);

  assert.equal(summary.settled.length, 1);
  assert.equal(summary.rejected.length, 0);
  assert.equal(rail.getTransfers().length, 1);
  assert.equal(summary.settled[0]?.receipt.request.amount, 100);
});

test('GateScheduler rejects transfers that exceed the amount limit', async () => {
  const { rail, scheduler } = createScheduler();

  const summary = await process(scheduler, [
    { id: 'job-2', request: createTransfer({ amount: 2_000 }), runAt: now },
  ]);

  assert.equal(summary.settled.length, 0);
  assert.equal(summary.rejected.length, 1);
  assert.match(summary.rejected[0]?.reason ?? '', /exceeds limit/);
  assert.equal(rail.getTransfers().length, 0);
});

test('GateScheduler rejects transfers that involve blocked accounts', async () => {
  const { rail, scheduler } = createScheduler();

  const summary = await process(scheduler, [
    {
      id: 'job-3',
      request: createTransfer({ toAccountId: 'fraudulent-account' }),
      runAt: now,
    },
  ]);

  assert.equal(summary.settled.length, 0);
  assert.equal(summary.rejected.length, 1);
  assert.match(summary.rejected[0]?.reason ?? '', /blocked account/);
  assert.equal(rail.getTransfers().length, 0);
});
