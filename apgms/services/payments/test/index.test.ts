import assert from 'node:assert/strict';
import test from 'node:test';

import { createPaymentsServer, Gate, PaymentsMetrics } from '../src/index.js';

test('POST /remit enqueues a new remittance with correlation id', async () => {
  const metrics = new PaymentsMetrics();
  const gate = new Gate('OPEN');
  const { app, store, queue } = createPaymentsServer({ metrics, gate });

  const response = await app.inject({
    method: 'POST',
    url: '/remit',
    payload: {
      amount: 105,
      currency: 'AUD',
      method: 'PAYTO',
      beneficiary: 'John Citizen',
    },
    headers: {
      'x-correlation-id': 'corr-123',
    },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.status, 'PENDING');
  assert.equal(body.correlationId, 'corr-123');
  assert.equal(metrics.metrics().includes('payments_remittance_enqueued_total 1'), true);

  assert.equal(queue.isPending(body.id), true);

  await app.close();
  const stored = await store.getRemittance(body.id);
  assert.equal(stored?.events.at(0)?.type, 'PENDING');
});

test('GET /remit/:id returns 404 when missing', async () => {
  const { app } = createPaymentsServer();
  const response = await app.inject({ method: 'GET', url: '/remit/does-not-exist' });
  assert.equal(response.statusCode, 404);
  await app.close();
});
