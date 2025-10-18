import { randomUUID } from "node:crypto";
import { auditEventContract, paymentLifecycleContract, type AuditEventJob, type BankFeedIngestJob, type PaymentLifecycleJob, type QueueClient } from "@apgms/shared";

export interface ReconciliationResult {
  feedId: string;
  credits: number;
  debits: number;
  total: number;
}

export interface ReconciliationDependencies {
  auditQueue?: QueueClient<AuditEventJob>;
  paymentQueue?: QueueClient<PaymentLifecycleJob>;
}

export async function reconcileBankFeed(
  feed: BankFeedIngestJob,
  { auditQueue, paymentQueue }: ReconciliationDependencies = {}
): Promise<ReconciliationResult> {
  const credits = feed.entries.filter((entry) => entry.amount > 0).length;
  const debits = feed.entries.filter((entry) => entry.amount < 0).length;
  const total = feed.entries.reduce((acc, entry) => acc + entry.amount, 0);

  if (paymentQueue) {
    await Promise.all(
      feed.entries
        .filter((entry) => entry.amount < 0)
        .map((entry) =>
          paymentQueue.add(paymentLifecycleContract.jobName, {
            payableId: randomUUID(),
            orgId: feed.orgId,
            amount: Math.abs(entry.amount),
            currency: entry.currency,
            dueDate: entry.postedAt,
            supplierName: entry.description ?? "Unknown supplier",
          })
        )
    );
  }

  if (auditQueue) {
    await auditQueue.add(auditEventContract.jobName, {
      eventId: randomUUID(),
      entityId: feed.feedId,
      eventType: "RECON_COMPLETED",
      occurredAt: new Date().toISOString(),
      payload: { credits, debits, total },
    });
  }

  return { feedId: feed.feedId, credits, debits, total };
}
