import { FastifyInstance } from "fastify";
import { getRpt, verifyChain, verifyRpt } from "../lib/rpt.js";

export const auditRoutes = async (app: FastifyInstance) => {
  app.get("/audit/rpt/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = getRpt(id);
    if (!record) {
      return reply.code(404).send({ ok: false, reason: "not_found" });
    }

    const verification = verifyRpt(record.token);
    if (!verification.ok) {
      return reply.code(400).send({ ok: false, reason: verification.reason ?? "invalid_signature" });
    }

    const chain = verifyChain(id);
    if (!chain.ok) {
      return reply.code(400).send({ ok: false, reason: chain.reason, rptId: chain.rptId, details: chain.details });
    }

    return reply.send({ ok: true, verified: true, hash: verification.hash, rpt: record.token });
  });
};

export default auditRoutes;
