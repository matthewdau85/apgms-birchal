import type { Processor } from '../queues/bullmq.js';

import { JOB_NAMES, type JobResult } from '../jobs.js';
import type { JobData } from '../jobs.js';

export const processReconciliationJob: Processor<
  JobData<typeof JOB_NAMES.RECONCILIATION>,
  JobResult<typeof JOB_NAMES.RECONCILIATION>,
  typeof JOB_NAMES.RECONCILIATION
> = async (job) => {
  const { accountId, triggeredBy } = job.data;

  await new Promise((resolve) => setTimeout(resolve, 5));

  return {
    reconciled: true,
    accountId,
    triggeredBy,
  };
};
