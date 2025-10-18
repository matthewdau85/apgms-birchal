import type { FastifyInstance } from "fastify";
import { prisma } from "@apgms/shared/db";
import { rptTokenSchema, rptVerificationSchema, rptChainVerificationSchema } from "../schemas/rpt.js";
import { fetchRptTokenById, verifyChain, verifyRpt } from "../lib/rpt.js";

export default async function auditRoutes(app: FastifyInstance) {
  app.get("/audit/rpt/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!id) {
      return reply.status(400).send({ error: "invalid_request" });
    }

    const token = await fetchRptTokenById(prisma, id);
    if (!token) {
      return reply.status(404).send({ error: "rpt_not_found" });
    }

    const verification = verifyRpt(token);
    const chain = await verifyChain(prisma, token.id);

    return reply.send({
      rptToken: rptTokenSchema.parse(token),
      verification: rptVerificationSchema.parse(verification),
      chain: rptChainVerificationSchema.parse(chain),
      status: verification.valid && chain.valid ? "valid" : "invalid",
    });
  });
}
