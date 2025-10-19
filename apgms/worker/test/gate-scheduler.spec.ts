import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAgreement,
  getAuditTrail,
  resetPaytoMockState,
} from '../../services/payments/src/index.js';
import {
  enqueueRemittance,
  getGateState,
  peekRemittanceQueue,
  resetPaytoSharedState,
  setGateState,
} from '../../shared/src/payto.js';
import { processQueuedRemittances } from '../src/gate-scheduler.js';

test('scheduler waits for gate to open before processing remittances', async () => {
  resetPaytoMockState();
  resetPaytoSharedState();

  const agreement = createAgreement({
    payerId: 'payer-gate',
    payeeId: 'merchant-gate',
    limit: 800,
  });

  setGateState('CLOSED');
  enqueueRemittance({
    agreementId: agreement.agreementId,
    amount: 75,
    currency: 'AUD',
  });

  assert.equal(getGateState(), 'CLOSED');
  assert.equal(peekRemittanceQueue().length, 1);

  const closedResult = await processQueuedRemittances();
  assert.equal(closedResult.length, 0);
  assert.equal(peekRemittanceQueue().length, 1, 'queue should remain untouched while gate is closed');
  assert.equal(getAuditTrail().length, 1, 'no new audit blob should be written while gate closed');

  setGateState('OPEN');
  const openResult = await processQueuedRemittances();
  assert.equal(openResult.length, 1);
  assert.equal(peekRemittanceQueue().length, 0);
  assert.equal(getAuditTrail().length, 2);
});

test('scheduler drains multiple remittances in FIFO order', async () => {
  resetPaytoMockState();
  resetPaytoSharedState();

  const agreement = createAgreement({
    payerId: 'payer-fifo',
    payeeId: 'merchant-fifo',
    limit: 1200,
  });

  setGateState('CLOSED');
  const first = enqueueRemittance({
    agreementId: agreement.agreementId,
    amount: 30,
    currency: 'AUD',
  });
  const second = enqueueRemittance({
    agreementId: agreement.agreementId,
    amount: 45,
    currency: 'AUD',
  });

  setGateState('OPEN');
  const processed = await processQueuedRemittances();
  assert.equal(processed.length, 2);
  assert.deepEqual(
    processed.map((entry) => entry.remitId),
    [first.remitId, second.remitId],
    'processed remittances should keep queue order',
  );
  assert.equal(getAuditTrail().length, 3);
});
