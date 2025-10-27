import { JOB_NAMES } from './jobs.js';
import {
  processAtoLodgementRetryJob,
  processPaymentRetryJob,
  processReconciliationJob,
} from './processors/index.js';
import { createWorker } from './queues/bullmq.js';

const workers = [
  createWorker(JOB_NAMES.RECONCILIATION, processReconciliationJob),
  createWorker(JOB_NAMES.PAYMENT_RETRY, processPaymentRetryJob),
  createWorker(JOB_NAMES.ATO_LODGEMENT_RETRY, processAtoLodgementRetryJob),
];

for (const worker of workers) {
  worker.on('completed', (job, result) => {
    console.log(`Job ${job.name} completed`, result);
  });

  worker.on('failed', (job, err) => {
    const name = job?.name ?? 'unknown';
    console.error(`Job ${name} failed`, err);
  });
}

console.log('Worker service initialised');
