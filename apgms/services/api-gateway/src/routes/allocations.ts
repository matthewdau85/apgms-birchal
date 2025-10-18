import type { FastifyInstance } from "fastify";

import { applyPolicy } from "shared/policy-engine/index.js";

import {
  allocationsApplyRequestSchema,
  allocationsApplyResponseSchema,
  allocationsPreviewRequestSchema,
  allocationsPreviewResponseSchema,
} from "../schemas/allocations.js";
import { getRpt, mintRpt, storeRpt } from "../lib/rpt.js";
import {
  appendAuditBlob,
  createAuditBlob,
  createLedgerEntries,
  persistLedgerEntries,
} from "../lib/persistence.js";

export async function registerAllocationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/allocations/preview", async (request, reply) => {
    try {
      const input = allocationsPreviewRequestSchema.parse(request.body);
      const preview = applyPolicy(input);
      const response = allocationsPreviewResponseSchema.parse(preview);
      return reply.send(response);
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: "invalid_request" });
    }
  });

  app.post("/allocations/apply", async (request, reply) => {
    try {
      const input = allocationsApplyRequestSchema.parse(request.body);
      const preview = applyPolicy(input);

      let prevHash: string | null = null;
      if (input.prevRptId) {
        const previous = getRpt(input.prevRptId);
        if (!previous) {
          return reply.code(400).send({ error: "unknown_prev_rpt" });
        }
        prevHash = previous.digest;
      }

      const rpt = await mintRpt({
        orgId: input.orgId,
        bankLineId: input.bankLineId,
        policyHash: preview.policyHash,
        allocations: preview.allocations,
        prevHash,
        now: new Date(),
      });

      storeRpt(rpt);

      const ledgerEntries = createLedgerEntries({
        orgId: input.orgId,
        bankLineId: input.bankLineId,
        allocations: preview.allocations,
        timestamp: rpt.timestamp,
      });
      persistLedgerEntries(ledgerEntries);

      const auditBlob = createAuditBlob(rpt, rpt.timestamp);
      appendAuditBlob(auditBlob);

      const responsePayload = allocationsApplyResponseSchema.parse({
        allocations: preview.allocations,
        policyHash: preview.policyHash,
        explain: preview.explain,
        rpt,
        ledgerEntries,
        auditBlob,
      });

      return reply.code(201).send(responsePayload);
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: "invalid_request" });
    }
  });
}
