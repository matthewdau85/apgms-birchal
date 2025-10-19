import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPaymentsServer,
  getAuditTrail,
  resetPaytoMockState,
} from '../src/index.js';
import { DEFAULT_ADMIN_TOKEN } from '../src/routes/payto.js';
import {
  getGateState,
  peekRemittanceQueue,
  resetPaytoSharedState,
  setGateState,
} from '../../../shared/src/payto.js';
import { processQueuedRemittances } from '../../../worker/src/gate-scheduler.js';

const ADMIN_HEADER = 'x-admin-token';

const adminHeaders = {
  'content-type': 'application/json',
  [ADMIN_HEADER]: process.env.PAYMENTS_ADMIN_TOKEN ?? DEFAULT_ADMIN_TOKEN,
};

test('creating agreements writes audit blobs', async (t) => {
  resetPaytoMockState();
  resetPaytoSharedState();
  const app = await buildPaymentsServer();

  const response = await app.inject({
    method: 'POST',
    url: '/payto/agreements',
    headers: adminHeaders,
    payload: {
      payerId: 'payer-001',
      payeeId: 'merchant-042',
      limit: 1000,
      description: 'monthly subscription',
    },
  });

  assert.equal(response.statusCode, 201);
  const { agreement } = response.json<{ agreement: { agreementId: string } }>();
  assert.ok(agreement.agreementId);

  const auditTrail = getAuditTrail();
  assert.equal(auditTrail.length, 1);
  assert.equal(auditTrail[0].type, 'payto.agreement.created');

  await app.close();
});

test('remittances queue behind a closed gate and are processed once opened', async (t) => {
  resetPaytoMockState();
  resetPaytoSharedState();
  const app = await buildPaymentsServer();

  const agreementResponse = await app.inject({
    method: 'POST',
    url: '/payto/agreements',
    headers: adminHeaders,
    payload: {
      payerId: 'payer-007',
      payeeId: 'merchant-777',
      limit: 5000,
    },
  });

  const { agreement } = agreementResponse.json<{ agreement: { agreementId: string } }>();

  // Process remit while gate is open
  const processedResponse = await app.inject({
    method: 'POST',
    url: '/payto/remit',
    headers: adminHeaders,
    payload: {
      agreementId: agreement.agreementId,
      amount: 125,
      currency: 'AUD',
    },
  });

  assert.equal(processedResponse.statusCode, 202);
  const processedBody = processedResponse.json();
  assert.equal(processedBody.status, 'processed');
  assert.equal(getAuditTrail().length, 2);

  // Close the gate and ensure the next remit is queued
  setGateState('CLOSED');
  const queuedResponse = await app.inject({
    method: 'POST',
    url: '/payto/remit',
    headers: adminHeaders,
    payload: {
      agreementId: agreement.agreementId,
      amount: 215,
      currency: 'AUD',
    },
  });

  assert.equal(queuedResponse.statusCode, 202);
  const queuedBody = queuedResponse.json();
  assert.equal(queuedBody.status, 'queued');
  assert.equal(getGateState(), 'CLOSED');
  assert.equal(peekRemittanceQueue().length, 1);
  assert.equal(getAuditTrail().length, 2, 'audit trail should not grow while gate is closed');

  // Worker processes queued remits once the gate opens
  setGateState('OPEN');
  const processed = await processQueuedRemittances();
  assert.equal(processed.length, 1);
  assert.equal(peekRemittanceQueue().length, 0);
  assert.equal(getAuditTrail().length, 3);

  await app.close();
});

test('non-admin requests are rejected', async () => {
  resetPaytoMockState();
  resetPaytoSharedState();
  const app = await buildPaymentsServer();

  const response = await app.inject({
    method: 'POST',
    url: '/payto/agreements',
    headers: { 'content-type': 'application/json' },
    payload: {
      payerId: 'payer-unauthorised',
      payeeId: 'merchant-unauthorised',
      limit: 100,
    },
  });

  assert.equal(response.statusCode, 403);

  await app.close();
});
