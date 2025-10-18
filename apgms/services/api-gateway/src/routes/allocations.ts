import type { FastifyPluginAsync } from "fastify";
import { allocationRequestSchema, previewAllocations } from "../lib/allocations";
import { mintRpt, type RptPayload } from "../lib/rpt";
import { kms } from "../lib/kms";
import { rptStore } from "../stores/rpt-store";

const allocationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/allocations/preview", async (request, reply) => {
    const result = allocationRequestSchema.safeParse(request.body);

    if (!result.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: result.error.format(),
      });
    }

    const preview = previewAllocations(result.data);
    return reply.send(preview);
  });

  fastify.post("/allocations/apply", async (request, reply) => {
    const result = allocationRequestSchema.safeParse(request.body);

    if (!result.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: result.error.format(),
      });
    }

    const preview = previewAllocations(result.data);

    if (!preview.totals.conserved) {
      return reply.code(400).send({
        error: "allocation_not_conserved",
        totals: preview.totals,
      });
    }

    const payload: RptPayload = {
      orgId: result.data.orgId,
      currency: result.data.currency,
      total: result.data.total,
      allocations: result.data.allocations,
      metadata: result.data.metadata ?? {},
    };

    const rpt = mintRpt(kms, payload);

    rptStore.set(rpt.id, rpt);

    return reply.code(201).send({ rptId: rpt.id });
  });
};

export default allocationsRoutes;
