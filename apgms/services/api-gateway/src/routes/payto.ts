import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ensureAdmin } from "../lib/admin";
import { isGateOpen, setGateStatus, PAYTO_GATE_ID } from "@apgms/shared";
import { createAgreement, remit } from "@apgms/payments/adapters/payto.mock";

const createAgreementSchema = z.object({
  orgId: z.string().min(1),
  maskedBsb: z.string().min(1),
  maskedAcc: z.string().min(1),
});

const remitSchema = z.object({
  orgId: z.string().min(1),
  amountCents: z.number().int().positive(),
});

export default async function registerPayToRoutes(app: FastifyInstance) {
  app.post("/agreements", async (req, reply) => {
    try {
      ensureAdmin(req, reply);
    } catch (err) {
      return reply.send({ error: "admin_required" });
    }

    const body = createAgreementSchema.parse(req.body ?? {});
    const result = await createAgreement(body);
    return reply.code(201).send(result);
  });

  app.post("/remit", async (req, reply) => {
    try {
      ensureAdmin(req, reply);
    } catch (err) {
      return reply.send({ error: "admin_required" });
    }

    const gate = await isGateOpen(PAYTO_GATE_ID);
    if (!gate) {
      return reply.code(409).send({ error: "gate_closed" });
    }

    const body = remitSchema.parse(req.body ?? {});
    const result = await remit(body);
    return reply.code(202).send(result);
  });

  app.post("/gate/:status", async (req, reply) => {
    try {
      ensureAdmin(req, reply);
    } catch (err) {
      return reply.send({ error: "admin_required" });
    }

    const status = (req.params as any).status?.toUpperCase();
    if (status !== "OPEN" && status !== "CLOSED") {
      return reply.code(400).send({ error: "invalid_status" });
    }

    await setGateStatus(PAYTO_GATE_ID, status);
    return reply.send({ gate: PAYTO_GATE_ID, status });
  });
}
