import type { FastifyInstance } from "fastify";

import { verifyChain, verifyRpt, getRpt } from "../lib/rpt.js";
import { rptVerificationResponseSchema } from "../schemas/rpt.js";

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  app.get("/audit/rpt/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const rpt = getRpt(params.id);

    if (!rpt) {
      return reply.code(404).send({ error: "not_found" });
    }

    const signature = verifyRpt(rpt);
    const chain = verifyChain(rpt.rptId);

    const payload = rptVerificationResponseSchema.parse({
      rptId: rpt.rptId,
      signatureValid: signature.ok,
      chain,
      rpt,
    });

    return reply.send(payload);
  });
}
