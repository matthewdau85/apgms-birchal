import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { bankLineService } from "../../services/bank-line.service";

const listQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).default(20),
});

const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string(),
  amount: z.number(),
  payee: z.string(),
  description: z.string(),
  createdAt: z.string(),
});

const bankLinesResponseSchema = z.object({
  lines: z.array(bankLineSchema),
});

const createBankLineSchema = z.object({
  orgId: z.string().min(1),
  date: z.coerce.date().transform((value) => value.toISOString()),
  amount: z.coerce.number(),
  payee: z.string().min(1),
  description: z.string().min(1),
});

export async function registerBankLineModule(app: FastifyInstance): Promise<void> {
  app.get(
    "/bank-lines",
    { preHandler: app.authenticate },
    async (request) => {
      const { take } = listQuerySchema.parse(request.query ?? {});
      const lines = await bankLineService.listBankLines(take);
      return bankLinesResponseSchema.parse({ lines });
    },
  );

  app.post(
    "/bank-lines",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const body = createBankLineSchema.parse(request.body ?? {});
      const created = await bankLineService.createBankLine({
        orgId: body.orgId,
        date: body.date,
        amount: body.amount,
        payee: body.payee,
        description: body.description,
      });

      return reply.code(201).send(bankLineSchema.parse(created));
    },
  );
}
