import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../../../shared/src/db";
import {
  bankLineResponseSchema,
  createBankLineBodySchema,
  listBankLinesQuerySchema,
  listBankLinesResponseSchema,
  type BankLineResponse,
  type CreateBankLineBody,
  type ListBankLinesQuery,
} from "../schemas/bank-lines";
import {
  validateBody,
  validateQuery,
  validateReply,
} from "../middleware/validate";

const decimalToCents = (value: Prisma.Decimal) =>
  Number(value.mul(100).toFixed(0));

const toBankLineResponse = (line: {
  id: string;
  orgId: string;
  date: Date;
  amount: Prisma.Decimal;
  payee: string;
  desc: string;
  createdAt: Date;
}): BankLineResponse => ({
  id: line.id,
  orgId: line.orgId,
  date: line.date.toISOString(),
  amountCents: decimalToCents(line.amount),
  payee: line.payee,
  desc: line.desc,
  createdAt: line.createdAt.toISOString(),
});

export default async function bankLinesRoutes(app: FastifyInstance) {
  app.get(
    "/bank-lines",
    {
      preValidation: [validateQuery(listBankLinesQuerySchema)],
      preSerialization: [validateReply(listBankLinesResponseSchema)],
    },
    async (request) => {
      const { take = 20 } = (request.query ?? {}) as ListBankLinesQuery;

      const lines = await prisma.bankLine.findMany({
        orderBy: { date: "desc" },
        take,
      });

      return {
        lines: lines.map(toBankLineResponse),
      };
    }
  );

  app.post(
    "/bank-lines",
    {
      preValidation: [validateBody(createBankLineBodySchema)],
      preSerialization: [validateReply(bankLineResponseSchema)],
    },
    async (request, reply) => {
      const body = request.body as CreateBankLineBody;

      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: new Prisma.Decimal(body.amountCents).div(100),
          payee: body.payee,
          desc: body.desc,
        },
      });

      reply.code(201);

      return toBankLineResponse(created);
    }
  );
}
