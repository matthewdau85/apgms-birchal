import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../../shared/src/db";
import { requireOrgScope, requireRole } from "../plugins/auth.js";

const bankLinesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/bank-lines",
    {
      preHandler: [requireRole("bank:read", "admin"), requireOrgScope()],
    },
    async (req) => {
      const { take, orgId } = req.query as { take?: string; orgId: string };
      const numericTake = Number(take ?? 20);
      const safeTake = Number.isFinite(numericTake) ? numericTake : 20;
      const limit = Math.min(Math.max(safeTake, 1), 200);

      const lines = await prisma.bankLine.findMany({
        where: { orgId },
        orderBy: { date: "desc" },
        take: limit,
      });

      return { lines };
    }
  );

  fastify.post(
    "/bank-lines",
    {
      preHandler: [requireRole("bank:write", "admin"), requireOrgScope()],
    },
    async (req, rep) => {
      try {
        const body = req.body as {
          orgId: string;
          date: string;
          amount: number | string;
          payee: string;
          desc: string;
        };

        const created = await prisma.bankLine.create({
          data: {
            orgId: body.orgId,
            date: new Date(body.date),
            amount: body.amount as any,
            payee: body.payee,
            desc: body.desc,
          },
        });

        return rep.code(201).send(created);
      } catch (error) {
        req.log.error(error);
        return rep.code(400).send({ error: "bad_request" });
      }
    }
  );
};

export default bankLinesRoutes;
