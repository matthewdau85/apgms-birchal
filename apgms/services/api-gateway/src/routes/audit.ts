import { FastifyInstance } from "fastify";
import { prisma } from "@apgms/shared/db";
import { verifyRpt } from "../lib/rpt.js";

export async function auditRoutes(app: FastifyInstance) {
  app.get("/audit/rpt/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = await prisma.rptToken.findUnique({ where: { id } });
    if (!record) {
      return reply.status(404).send({ error: "not_found" });
    }
    const allocations = Array.isArray(record.allocationsJson)
      ? (record.allocationsJson as any[]).map((item) => ({
          bucket: String(item.bucket ?? ""),
          amountCents: Number(item.amountCents ?? 0),
          currency: String(item.currency ?? ""),
          memo: item.memo ?? null,
        }))
      : [];
    const verified = await verifyRpt({
      id: record.id,
      orgId: record.orgId,
      bankLineId: record.bankLineId,
      policyHash: record.policyHash,
      allocations,
      prevHash: record.prevHash,
      timestamp: record.timestamp,
      sig: record.sig,
    });
    if (!verified) {
      return reply.status(422).send({ error: "invalid_signature" });
    }
    return reply.send({
      rpt: {
        id: record.id,
        orgId: record.orgId,
        bankLineId: record.bankLineId,
        policyHash: record.policyHash,
        allocations,
        prevHash: record.prevHash,
        sig: record.sig,
        timestamp: record.timestamp.toISOString(),
      },
      verified,
    });
  });
}
