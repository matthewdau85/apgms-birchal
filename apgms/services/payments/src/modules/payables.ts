import { randomUUID } from "node:crypto";
import { auditEventContract, paymentLifecycleContract, type AuditEventJob, type PaymentLifecycleJob, type QueueClient } from "@apgms/shared";

export interface CreatePaymentPayload {
  orgId: string;
  amount: number;
  currency?: string;
  dueDate: string;
  supplierName: string;
}

export async function queuePaymentLifecycle(
  payload: CreatePaymentPayload,
  paymentQueue: QueueClient<PaymentLifecycleJob>,
  auditQueue?: QueueClient<AuditEventJob>
) {
  const job = paymentLifecycleContract.schema.parse({
    payableId: randomUUID(),
    orgId: payload.orgId,
    amount: payload.amount,
    currency: payload.currency ?? "AUD",
    dueDate: payload.dueDate,
    supplierName: payload.supplierName,
  });

  await paymentQueue.add(paymentLifecycleContract.jobName, job, {
    removeOnComplete: true,
    removeOnFail: true,
  });

  if (auditQueue) {
    await auditQueue.add(auditEventContract.jobName, {
      eventId: randomUUID(),
      entityId: job.payableId,
      eventType: "PAYMENT_REQUESTED",
      occurredAt: new Date().toISOString(),
      payload: { orgId: job.orgId, amount: job.amount, supplierName: job.supplierName },
    });
  }

  return job;
}

export async function handlePaymentLifecycle(
  job: PaymentLifecycleJob,
  auditQueue?: QueueClient<AuditEventJob>
) {
  if (auditQueue) {
    await auditQueue.add(auditEventContract.jobName, {
      eventId: randomUUID(),
      entityId: job.payableId,
      eventType: "PAYMENT_SETTLED",
      occurredAt: new Date().toISOString(),
      payload: { amount: job.amount, orgId: job.orgId },
    });
  }

  return { payableId: job.payableId, settled: true };
}
