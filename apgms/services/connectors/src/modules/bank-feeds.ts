import { randomUUID } from "node:crypto";
import { auditEventContract, bankFeedIngestContract, type AuditEventJob, type BankFeedIngestJob, type QueueClient } from "@apgms/shared";

export interface IngestBankFeedResult {
  feedId: string;
  queuedJobs: number;
}

export async function ingestBankFeed(
  payload: unknown,
  bankFeedQueue: QueueClient<BankFeedIngestJob>,
  auditQueue?: QueueClient<AuditEventJob>
): Promise<IngestBankFeedResult> {
  const data = bankFeedIngestContract.schema.parse(payload);
  await bankFeedQueue.add(bankFeedIngestContract.jobName, data, {
    removeOnComplete: true,
    removeOnFail: true,
  });

  if (auditQueue) {
    await auditQueue.add(auditEventContract.jobName, {
      eventId: randomUUID(),
      entityId: data.feedId,
      eventType: "BANK_FEED_RECEIVED",
      occurredAt: new Date().toISOString(),
      payload: {
        orgId: data.orgId,
        source: data.source,
        entries: data.entries.length,
      },
    });
  }

  return { feedId: data.feedId, queuedJobs: data.entries.length };
}
