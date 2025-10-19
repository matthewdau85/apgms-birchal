import { FastifyPluginAsync } from "fastify";
import { prisma } from "@apgms/shared/db";
import { verifyChain } from "../lib/rpt.js";
import { RptResponseSchema } from "../schemas/rpt.js";

const auditRoutes: FastifyPluginAsync = async (app) => {
  app.get("/audit/rpt/:rptId", async (req) => {
    const { rptId } = req.params as { rptId: string };
    const tokens = await prisma.rptToken.findMany({
      where: { rptId },
      orderBy: { createdAt: "asc" },
    });

    const serialized = tokens.map((token) => ({
      ...token,
      prevHash: token.prevHash ?? null,
      createdAt: token.createdAt.toISOString(),
    }));

    const chainValid = verifyChain(
      serialized.map((token) => ({
        rptId: token.rptId,
        bankLineId: token.bankLineId,
        orgId: token.orgId,
        payload: token.payload,
        prevHash: token.prevHash,
        signature: token.signature,
        hash: token.hash,
        publicKey: token.publicKey,
      }))
    );

    const response = {
      rptId,
      tokens: serialized,
      chainValid,
    };

    return RptResponseSchema.parse(response);
  });
};

export default auditRoutes;
