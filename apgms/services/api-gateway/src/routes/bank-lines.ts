import { BankLine } from "@prisma/client";
import { FastifyPluginAsync } from "fastify";
import { prisma } from "../../../../shared/src/db";
import { validateBody, validateQuery, validateReply } from "../middleware/validate";
import {
  BankLineResp,
  CreateBankLineBody,
  ListBankLinesQuery,
} from "../schemas/bank-lines";
import { z } from "zod";

const BankLinesReply = z.object({ lines: BankLineResp.array() });

const toBankLineResp = (line: BankLine) => ({
  id: line.id,
  orgId: line.orgId,
  date: line.date.toISOString(),
  amountCents: Math.round(line.amount.toNumber() * 100),
  payee: line.payee,
  desc: line.desc,
  createdAt: line.createdAt.toISOString(),
});

export const registerBankLineRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/bank-lines",
    {
      preHandler: [validateQuery(ListBankLinesQuery)],
      preSerialization: validateReply(BankLinesReply),
    },
    async (req) => {
      const query = req.query as z.infer<typeof ListBankLinesQuery>;
      const take = query.take ?? 20;

      const lines = await prisma.bankLine.findMany({
        where: { orgId: query.orgId },
        orderBy: { date: "desc" },
        take,
        ...(query.cursor
          ? {
              skip: 1,
              cursor: { id: query.cursor },
            }
          : {}),
      });

      return { lines: lines.map(toBankLineResp) };
    }
  );

  app.post(
    "/bank-lines",
    {
      preHandler: [validateBody(CreateBankLineBody)],
      preSerialization: validateReply(BankLineResp),
    },
    async (req, reply) => {
      const body = req.body as z.infer<typeof CreateBankLineBody>;

      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: (body.amountCents / 100).toFixed(2),
          payee: body.payee,
          desc: body.desc,
        },
      });

      return reply.code(201).send(toBankLineResp(created));
    }
  );
};
