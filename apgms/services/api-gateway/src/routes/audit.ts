import { FastifyPluginAsync } from "fastify";
import {
  getLatestRptByBankLineId,
  getRptById,
  verifyRpt,
  verifyChain,
} from "../lib/rpt";

export const auditRoutes: FastifyPluginAsync = async (app) => {
  app.get("/audit/rpt/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const rpt = getRptById(id);

    if (!rpt) {
      return reply.code(404).send({ error: "not_found" });
    }

    const verified = verifyRpt(rpt);
    const chain = verifyChain(rpt.rptId);

    return {
      rpt: {
        id: rpt.rptId,
        payload: rpt.payload,
        sig: rpt.sig,
      },
      verified,
      chain,
    };
  });

  app.get("/audit/rpt/by-line/:bankLineId", async (request, reply) => {
    const { bankLineId } = request.params as { bankLineId: string };
    const rpt = getLatestRptByBankLineId(bankLineId);

    if (!rpt) {
      return reply.code(404).send({ error: "not_found" });
    }

    const verified = verifyRpt(rpt);
    const chain = verifyChain(rpt.rptId);

    return {
      rpt: {
        id: rpt.rptId,
        payload: rpt.payload,
        sig: rpt.sig,
      },
      verified,
      chain,
    };
  });
};

export default auditRoutes;
