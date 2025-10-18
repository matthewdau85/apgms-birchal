import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { reconciliationService } from "../../services/reconciliation.service";

const paramsSchema = z.object({
  orgId: z.string().min(1),
});

const reconciliationSchema = z.object({
  orgId: z.string(),
  totalCredits: z.number(),
  totalDebits: z.number(),
  netBalance: z.number(),
  transactionCount: z.number(),
});

export async function registerReconciliationModule(app: FastifyInstance): Promise<void> {
  app.get(
    "/orgs/:orgId/reconciliation",
    { preHandler: app.authenticate },
    async (request) => {
      const { orgId } = paramsSchema.parse(request.params ?? {});
      const reconciliation = await reconciliationService.getOrgReconciliation(orgId);
      return reconciliationSchema.parse(reconciliation);
    },
  );
}
