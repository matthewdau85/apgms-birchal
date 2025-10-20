import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Gate,
  InMemoryRemittanceQueue,
  MockBECSAdapter,
  MockPayToAdapter,
  PaymentsMetrics,
  TransferStore,
} from '../../payments/src/index.js';

import { RemittanceScheduler } from '../src/index.js';

test('scheduler waits for gate to open before dequeuing', async () => {
  const gate = new Gate('CLOSED');
  const queue = new InMemoryRemittanceQueue(gate);
  const store = new TransferStore();
  const metrics = new PaymentsMetrics();
  const payTo = new MockPayToAdapter();
  const becs = new MockBECSAdapter();

  const remit = await store.createRemittance({
    amount: 99,
    currency: 'AUD',
    method: 'PAYTO',
    beneficiary: 'ACME',
  });

  queue.enqueue(remit.id);
  const scheduler = new RemittanceScheduler({
    gate,
    queue,
    store,
    metrics,
    adapters: { PAYTO: payTo, BECS: becs },
  });

  const firstAttempt = await scheduler.runOnce();
  assert.equal(firstAttempt, false);
  assert.equal(payTo.createCalls, 0);

  gate.open();
  await scheduler.runOnce();
  assert.equal(payTo.createCalls, 1);
  const settled = await store.getRemittance(remit.id);
  assert.equal(settled?.status, 'SETTLED');
});

test('no double-send occurs under concurrent workers', async () => {
  const gate = new Gate('OPEN');
  const queue = new InMemoryRemittanceQueue(gate);
  const store = new TransferStore();
  const metrics = new PaymentsMetrics();
  const payTo = new MockPayToAdapter();
  const becs = new MockBECSAdapter();

  const remit = await store.createRemittance({
    amount: 250,
    currency: 'AUD',
    method: 'PAYTO',
    beneficiary: 'Widget Co',
  });

  queue.enqueue(remit.id);

  const schedulerA = new RemittanceScheduler({
    gate,
    queue,
    store,
    metrics,
    adapters: { PAYTO: payTo, BECS: becs },
  });

  const schedulerB = new RemittanceScheduler({
    gate,
    queue,
    store,
    metrics,
    adapters: { PAYTO: payTo, BECS: becs },
  });

  await Promise.all([schedulerA.runOnce(), schedulerB.runOnce()]);

  assert.equal(payTo.createCalls, 1);
  const final = await store.getRemittance(remit.id);
  assert.equal(final?.status, 'SETTLED');
  const eventTypes = final?.events.map((event) => event.type) ?? [];
  assert.deepEqual(eventTypes, ['PENDING', 'INITIATED', 'SETTLED']);
});
