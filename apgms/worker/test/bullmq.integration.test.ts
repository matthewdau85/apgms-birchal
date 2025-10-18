import test from 'node:test';
import assert from 'node:assert/strict';

import { JOB_NAMES } from '../src/jobs.js';
import {
  processAtoLodgementRetryJob,
  processPaymentRetryJob,
  processReconciliationJob,
} from '../src/processors/index.js';
import { createQueue, createQueueEvents, createWorker } from '../src/queues/bullmq.js';

type ConnectionOverrides = Parameters<typeof createQueue>[2];

class TestRedisInstance {
  private readonly host: string;
  private readonly port: number;
  private readonly db: number;

  constructor(host = '127.0.0.1', port = 6380, db = 1) {
    this.host = host;
    this.port = port;
    this.db = db;
  }

  async start() {
    return Promise.resolve();
  }

  async stop() {
    return Promise.resolve();
  }

  get connection(): ConnectionOverrides {
    return {
      host: this.host,
      port: this.port,
      db: this.db,
    };
  }
}

test.describe('BullMQ queues', () => {
  let redis: TestRedisInstance;
  let connectionOverrides: ConnectionOverrides;

  test.before(async () => {
    redis = new TestRedisInstance();
    await redis.start();
    connectionOverrides = redis.connection;
  });

  test.after(async () => {
    await redis.stop();
  });

  test('processes reconciliation jobs', async () => {
    const queue = createQueue(JOB_NAMES.RECONCILIATION, {}, connectionOverrides);
    const events = createQueueEvents(JOB_NAMES.RECONCILIATION, {}, connectionOverrides);
    const worker = createWorker(JOB_NAMES.RECONCILIATION, processReconciliationJob, {}, connectionOverrides);

    await events.waitUntilReady();
    await worker.waitUntilReady();

    const job = await queue.add(JOB_NAMES.RECONCILIATION, {
      accountId: 'acct-1',
      triggeredBy: 'system',
    });

    const result = await job.waitUntilFinished(events);

    assert.deepStrictEqual(result, {
      reconciled: true,
      accountId: 'acct-1',
      triggeredBy: 'system',
    });

    await worker.close();
    await events.close();
    await queue.close();
  });

  test('processes payment retry jobs', async () => {
    const queue = createQueue(JOB_NAMES.PAYMENT_RETRY, {}, connectionOverrides);
    const events = createQueueEvents(JOB_NAMES.PAYMENT_RETRY, {}, connectionOverrides);
    const worker = createWorker(JOB_NAMES.PAYMENT_RETRY, processPaymentRetryJob, {}, connectionOverrides);

    await events.waitUntilReady();
    await worker.waitUntilReady();

    const job = await queue.add(JOB_NAMES.PAYMENT_RETRY, {
      paymentId: 'pay-123',
      retryCount: 2,
    });

    const result = await job.waitUntilFinished(events);

    assert.deepStrictEqual(result, {
      paymentId: 'pay-123',
      nextRetryCount: 3,
      shouldNotify: false,
    });

    await worker.close();
    await events.close();
    await queue.close();
  });

  test('processes ATO lodgement retry jobs', async () => {
    const queue = createQueue(JOB_NAMES.ATO_LODGEMENT_RETRY, {}, connectionOverrides);
    const events = createQueueEvents(JOB_NAMES.ATO_LODGEMENT_RETRY, {}, connectionOverrides);
    const worker = createWorker(
      JOB_NAMES.ATO_LODGEMENT_RETRY,
      processAtoLodgementRetryJob,
      {},
      connectionOverrides,
    );

    await events.waitUntilReady();
    await worker.waitUntilReady();

    const job = await queue.add(JOB_NAMES.ATO_LODGEMENT_RETRY, {
      lodgementId: 'lodgement-99',
      attempt: 1,
    });

    const result = await job.waitUntilFinished(events);

    assert.deepStrictEqual(result, {
      lodgementId: 'lodgement-99',
      attempt: 1,
      queued: true,
    });

    await worker.close();
    await events.close();
    await queue.close();
  });
});
