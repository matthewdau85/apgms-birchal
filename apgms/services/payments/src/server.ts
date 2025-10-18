import Fastify, { type FastifyInstance } from "fastify";
import type IORedis from "ioredis";
import { createWorker, queueContracts, type AuditEventJob, type PaymentLifecycleJob, type QueueClient } from "@apgms/shared";
import { handlePaymentLifecycle, queuePaymentLifecycle, type CreatePaymentPayload } from "./modules/payables";

export interface PaymentsDependencies {
  paymentQueue: QueueClient<PaymentLifecycleJob>;
  auditQueue?: QueueClient<AuditEventJob>;
  serviceName?: string;
}

export function createPaymentsServer({ paymentQueue, auditQueue, serviceName = "payments" }: PaymentsDependencies): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok", service: serviceName }));

  app.post<{
    Body: CreatePaymentPayload;
  }>("/payments", async (request, reply) => {
    const job = await queuePaymentLifecycle(request.body, paymentQueue, auditQueue);
    return reply.code(202).send({ payableId: job.payableId });
  });

  return app;
}

export async function createPaymentsWorker(connection: IORedis, auditQueue?: QueueClient<AuditEventJob>) {
  return createWorker(queueContracts.paymentLifecycle, connection, async (payload) => {
    await handlePaymentLifecycle(payload, auditQueue);
  });
}
