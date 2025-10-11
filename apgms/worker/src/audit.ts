import { randomUUID } from 'crypto';
import { logger } from './logger.js';

export type AuditEvent = {
  id: string;
  timestamp: string;
  queue: string;
  jobId: string;
  jobName: string;
  type: 'queue.job.processed' | 'queue.job.failed';
  payload: unknown;
  error?: string;
};

export async function writeAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>) {
  const entry: AuditEvent = {
    ...event,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  logger.info({ event: 'audit.recorded', audit: entry }, 'Audit event recorded');
}
