export const JOB_NAMES = {
  RECONCILIATION: 'reconciliation',
  PAYMENT_RETRY: 'payment-retry',
  ATO_LODGEMENT_RETRY: 'ato-lodgement-retry',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export interface ReconciliationJobData {
  accountId: string;
  triggeredBy: 'system' | 'user';
}

export interface PaymentRetryJobData {
  paymentId: string;
  retryCount: number;
}

export interface AtoLodgementRetryJobData {
  lodgementId: string;
  attempt: number;
}

export interface ReconciliationJobResult {
  reconciled: boolean;
  accountId: string;
  triggeredBy: ReconciliationJobData['triggeredBy'];
}

export interface PaymentRetryJobResult {
  paymentId: string;
  nextRetryCount: number;
  shouldNotify: boolean;
}

export interface AtoLodgementRetryJobResult {
  lodgementId: string;
  attempt: number;
  queued: boolean;
}

interface JobPayloads {
  [JOB_NAMES.RECONCILIATION]: ReconciliationJobData;
  [JOB_NAMES.PAYMENT_RETRY]: PaymentRetryJobData;
  [JOB_NAMES.ATO_LODGEMENT_RETRY]: AtoLodgementRetryJobData;
}

interface JobResults {
  [JOB_NAMES.RECONCILIATION]: ReconciliationJobResult;
  [JOB_NAMES.PAYMENT_RETRY]: PaymentRetryJobResult;
  [JOB_NAMES.ATO_LODGEMENT_RETRY]: AtoLodgementRetryJobResult;
}

export type JobData<Name extends JobName> = JobPayloads[Name];
export type JobResult<Name extends JobName> = JobResults[Name];
