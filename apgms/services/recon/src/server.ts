import Fastify, { type FastifyInstance } from "fastify";
import type IORedis from "ioredis";
import { createWorker, queueContracts } from "@apgms/shared";
import { reconcileBankFeed, type ReconciliationDependencies } from "./modules/reconciliation";

export function createReconServer(serviceName = "recon"): FastifyInstance {
  const app = Fastify({ logger: true });
  app.get("/health", async () => ({ status: "ok", service: serviceName }));
  return app;
}

export async function startReconciliationWorker(connection: IORedis, dependencies: ReconciliationDependencies) {
  return createWorker(queueContracts.bankFeedIngest, connection, async (payload) => {
    await reconcileBankFeed(payload, dependencies);
  });
}
