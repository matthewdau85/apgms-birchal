import Fastify, { type FastifyInstance } from "fastify";
import type IORedis from "ioredis";
import { auditEventContract, createWorker, queueContracts, type AuditEventJob, type QueueClient } from "@apgms/shared";
import { listAuditEvents, recordAuditEvent } from "./modules/audit-trail";

export interface AuditDependencies {
  auditQueue: QueueClient<AuditEventJob>;
  serviceName?: string;
}

export function createAuditServer({ auditQueue, serviceName = "audit" }: AuditDependencies): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok", service: serviceName }));

  app.get("/events", async () => ({ events: listAuditEvents() }));

  app.post("/events", async (request, reply) => {
    const event = auditEventContract.schema.parse(request.body);
    const recorded = recordAuditEvent(event);
    await auditQueue.add(queueContracts.auditEvent.jobName, recorded, {
      removeOnComplete: true,
      removeOnFail: true,
    });
    return reply.code(202).send({ eventId: recorded.eventId });
  });

  return app;
}

export async function createAuditWorker(connection: IORedis) {
  return createWorker(queueContracts.auditEvent, connection, async (payload) => {
    recordAuditEvent(payload);
  });
}
