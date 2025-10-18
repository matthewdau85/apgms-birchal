import type { Processor } from '../queues/bullmq.js';

import { JOB_NAMES, type JobResult } from '../jobs.js';
import type { JobData } from '../jobs.js';

export const processPaymentRetryJob: Processor<
  JobData<typeof JOB_NAMES.PAYMENT_RETRY>,
  JobResult<typeof JOB_NAMES.PAYMENT_RETRY>,
  typeof JOB_NAMES.PAYMENT_RETRY
> = async (job) => {
  const { paymentId, retryCount } = job.data;

  const shouldNotify = retryCount >= 3;

  return {
    paymentId,
    nextRetryCount: retryCount + 1,
    shouldNotify,
  };
};
