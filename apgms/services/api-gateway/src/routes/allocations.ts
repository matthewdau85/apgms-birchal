import type { FastifyInstance } from "fastify";
import { prisma } from "@apgms/shared/db";
import { applyPolicy } from "@apgms/shared/policy-engine";
import {
  previewAllocationsRequestSchema,
  previewAllocationsResponseSchema,
  applyAllocationsRequestSchema,
  applyAllocationsResponseSchema,
} from "../schemas/allocations.js";
import {
  fetchLatestRptTokenForOrg,
  mintRpt,
  saveRptToken,
  verifyChain,
  verifyRpt,
} from "../lib/rpt.js";

export default async function allocationsRoutes(app: FastifyInstance) {
  app.post("/allocations/preview", async (request, reply) => {
    const parsed = previewAllocationsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request", issues: parsed.error.issues });
    }

    const bankLine = await prisma.bankLine.findUnique({ where: { id: parsed.data.bankLineId } });
    if (!bankLine || bankLine.orgId !== parsed.data.orgId) {
      return reply.status(404).send({ error: "bank_line_not_found" });
    }

    const { policyHash, allocations } = applyPolicy({
      orgId: parsed.data.orgId,
      bankLine: {
        id: bankLine.id,
        amount: Number(bankLine.amount),
        payee: bankLine.payee,
        desc: bankLine.desc,
        date: bankLine.date,
      },
    });

    return reply.send(previewAllocationsResponseSchema.parse({ policyHash, allocations }));
  });

  app.post("/allocations/apply", async (request, reply) => {
    const parsed = applyAllocationsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request", issues: parsed.error.issues });
    }

    const bankLine = await prisma.bankLine.findUnique({ where: { id: parsed.data.bankLineId } });
    if (!bankLine || bankLine.orgId !== parsed.data.orgId) {
      return reply.status(404).send({ error: "bank_line_not_found" });
    }

    const { policyHash, allocations } = applyPolicy({
      orgId: parsed.data.orgId,
      bankLine: {
        id: bankLine.id,
        amount: Number(bankLine.amount),
        payee: bankLine.payee,
        desc: bankLine.desc,
        date: bankLine.date,
      },
    });

    const previous = await fetchLatestRptTokenForOrg(prisma, parsed.data.orgId);
    const token = mintRpt({
      orgId: parsed.data.orgId,
      bankLineId: bankLine.id,
      policyHash,
      allocations,
      prevHash: previous?.hash ?? null,
      now: parsed.data.now ?? new Date(),
    });

    await saveRptToken(prisma, token);

    const verification = verifyRpt(token);
    const chain = await verifyChain(prisma, token.id);

    return reply.status(201).send(
      applyAllocationsResponseSchema.parse({
        rptToken: token,
        verification,
        chain,
      }),
    );
  });
}
