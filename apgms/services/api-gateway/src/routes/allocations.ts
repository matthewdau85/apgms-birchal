import { randomUUID } from "node:crypto";
import { FastifyInstance } from "fastify";
import {
  applyAllocationsRequestSchema,
  applyAllocationsResponseSchema,
  previewAllocationsRequestSchema,
  previewAllocationsResponseSchema,
} from "../schemas/allocations.js";
import { hashCanonical, mintRpt, persistLedgerEntry, persistRpt, getLatestRptForOrg } from "../lib/rpt.js";

const formatExplain = (orgId: string, allocationCount: number, totalCents: number): string => {
  const dollars = (totalCents / 100).toFixed(2);
  return `Preview for org ${orgId}: ${allocationCount} allocations totaling $${dollars}`;
};

export const allocationsRoutes = async (app: FastifyInstance) => {
  app.post("/allocations/preview", async (request, reply) => {
    const parsed = previewAllocationsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, reason: parsed.error.message });
    }

    const { orgId, bankLineId, policy, allocations } = parsed.data;
    const { hash: policyHash } = hashCanonical({ orgId, bankLineId, policy });
    const totalCents = allocations.reduce((acc, item) => acc + item.amountCents, 0);
    const explain = formatExplain(orgId, allocations.length, totalCents);

    return reply.send(
      previewAllocationsResponseSchema.parse({
        ok: true,
        policyHash,
        allocations,
        explain,
      }),
    );
  });

  app.post("/allocations/apply", async (request, reply) => {
    const parsed = applyAllocationsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, reason: parsed.error.message });
    }

    const { rptId, orgId, bankLineId, policy, allocations, timestamp } = parsed.data;
    const { hash: policyHash } = hashCanonical({ orgId, bankLineId, policy });
    const prev = getLatestRptForOrg(orgId);
    const prevHash = prev?.hash ?? null;
    const minted = mintRpt({
      rptId,
      orgId,
      bankLineId,
      policyHash,
      allocations,
      prevHash,
      timestamp,
    });

    const storedRpt = persistRpt(minted);
    persistLedgerEntry({
      rptId: storedRpt.token.rptId,
      orgId: storedRpt.token.orgId,
      bankLineId: storedRpt.token.bankLineId,
      policyHash: storedRpt.token.policyHash,
      allocations: storedRpt.token.allocations,
      prevHash: storedRpt.token.prevHash,
      createdAt: storedRpt.token.timestamp,
      id: randomUUID(),
    });

    return reply.code(201).send(
      applyAllocationsResponseSchema.parse({
        ok: true,
        policyHash,
        rpt: storedRpt,
      }),
    );
  });
};

export default allocationsRoutes;
