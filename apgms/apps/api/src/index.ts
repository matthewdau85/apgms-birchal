import Fastify from "fastify";
import cors from "@fastify/cors";

import { MockBecs, MockPayTo } from "./rails";
import {
  GateOrchestrator,
  GateOrchestratorSnapshot,
} from "./services/gate-orchestrator";

const app = Fastify({ logger: true });

const orchestrator = new GateOrchestrator({
  pollIntervalMs: 400,
  adapters: [new MockPayTo(), new MockBecs()],
  gates: [
    { id: "payto-gate", label: "PayTo instant gate", rail: "payto", initiallyOpen: true },
    { id: "becs-gate", label: "BECS batch gate", rail: "becs", initiallyOpen: false },
  ],
});

orchestrator.start();

orchestrator.on("audit", (entry) => {
  app.log.info({ audit: entry }, "audit");
});

await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true, service: "api" }));

app.get("/status", async (): Promise<GateOrchestratorSnapshot> => orchestrator.getSnapshot());

app.get("/gates", async () => ({ gates: orchestrator.getSnapshot().gates }));

app.post<{ Params: { gateId: string } }>(
  "/gates/:gateId/open",
  async (request, reply) => {
    try {
      const gate = orchestrator.setGateOpen(request.params.gateId, true);
      return reply.code(200).send({ gate });
    } catch (error) {
      request.log.error(error);
      return reply.code(404).send({ error: "gate_not_found" });
    }
  },
);

app.post<{ Params: { gateId: string } }>(
  "/gates/:gateId/close",
  async (request, reply) => {
    try {
      const gate = orchestrator.setGateOpen(request.params.gateId, false);
      return reply.code(200).send({ gate });
    } catch (error) {
      request.log.error(error);
      return reply.code(404).send({ error: "gate_not_found" });
    }
  },
);

app.get("/remittances", async () => ({ remittances: orchestrator.getSnapshot().remittances }));

app.post("/remittances", async (request, reply) => {
  const body = request.body as Record<string, unknown> | undefined;
  const gateId = typeof body?.gateId === "string" ? body.gateId : undefined;
  const currency = typeof body?.currency === "string" ? body.currency : undefined;
  const beneficiaryName =
    typeof body?.beneficiaryName === "string" ? body.beneficiaryName : undefined;
  const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  const description = typeof body?.description === "string" ? body.description : undefined;
  const metadataValue = body?.metadata;
  const metadata =
    typeof metadataValue === "object" && metadataValue !== null && !Array.isArray(metadataValue)
      ? (metadataValue as Record<string, unknown>)
      : undefined;

  if (!gateId || !currency || !beneficiaryName || !Number.isFinite(amount)) {
    return reply.code(400).send({ error: "invalid_payload" });
  }

  try {
    const remittance = orchestrator.createPendingRemittance({
      gateId,
      amount,
      currency,
      beneficiaryName,
      description,
      metadata,
    });
    return reply.code(201).send({ remittance });
  } catch (error) {
    request.log.error(error);
    return reply.code(404).send({ error: "gate_not_found" });
  }
});

app.get("/audits", async () => ({ audits: orchestrator.getAuditLog() }));

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = "0.0.0.0";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
