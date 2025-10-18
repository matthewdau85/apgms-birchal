import type { Processor } from '../queues/bullmq.js';

import { JOB_NAMES, type JobResult } from '../jobs.js';
import type { JobData } from '../jobs.js';

export const processAtoLodgementRetryJob: Processor<
  JobData<typeof JOB_NAMES.ATO_LODGEMENT_RETRY>,
  JobResult<typeof JOB_NAMES.ATO_LODGEMENT_RETRY>,
  typeof JOB_NAMES.ATO_LODGEMENT_RETRY
> = async (job) => {
  const { lodgementId, attempt } = job.data;

  return {
    lodgementId,
    attempt,
    queued: attempt < 3,
  };
};
