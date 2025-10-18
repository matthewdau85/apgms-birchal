import type { FastifyInstance } from "fastify";
import { prisma } from "../../../../shared/src/db";
import { replyValidate } from "../lib/replyValidate";
import {
  bankLineCreateBodySchema,
  bankLineCreateResponseSchema,
  bankLineErrorSchema,
  bankLineListQuerySchema,
  bankLineListResponseSchema,
} from "../schemas/bank-lines";

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: { toString(): string };
  payee: string;
  desc: string;
  createdAt: Date;
};

const serializeBankLine = (line: BankLineRecord) => ({
  id: line.id,
  orgId: line.orgId,
  date: line.date.toISOString(),
  amount: line.amount.toString(),
  payee: line.payee,
  desc: line.desc,
  createdAt: line.createdAt.toISOString(),
});

export async function bankLinesRoutes(app: FastifyInstance) {
  app.get("/bank-lines", async (req, rep) => {
    const { take } = bankLineListQuerySchema.parse(req.query ?? {});
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take,
    });

    return replyValidate(rep, bankLineListResponseSchema).send({
      lines: lines.map(serializeBankLine),
    });
  });

  app.post("/bank-lines", async (req, rep) => {
    try {
      const body = bankLineCreateBodySchema.parse(req.body);
      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount:
            typeof body.amount === "string" ? body.amount : body.amount.toString(),
          payee: body.payee,
          desc: body.desc,
        },
      });

      return replyValidate(rep, bankLineCreateResponseSchema)
        .code(201)
        .send(serializeBankLine(created));
    } catch (error) {
      req.log.error(error);
      return replyValidate(rep, bankLineErrorSchema)
        .code(400)
        .send({ error: "bad_request" });
    }
  });
}
