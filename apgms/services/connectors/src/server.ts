import Fastify, { type FastifyInstance } from "fastify";
import { type AuditEventJob, type BankFeedIngestJob, type QueueClient } from "@apgms/shared";
import { ingestBankFeed } from "./modules/bank-feeds";

export interface ConnectorsDependencies {
  bankFeedQueue: QueueClient<BankFeedIngestJob>;
  auditQueue?: QueueClient<AuditEventJob>;
  serviceName?: string;
}

export function createConnectorsServer({
  bankFeedQueue,
  auditQueue,
  serviceName = "connectors",
}: ConnectorsDependencies): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok", service: serviceName }));

  app.post("/bank-feeds", async (request, reply) => {
    const result = await ingestBankFeed(request.body, bankFeedQueue, auditQueue);
    return reply.code(202).send(result);
  });

  return app;
}
