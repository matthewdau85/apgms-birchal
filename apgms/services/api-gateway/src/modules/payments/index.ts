import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { paymentService } from "../../services/payment.service";

const paramsSchema = z.object({
  orgId: z.string().min(1),
});

const paymentSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  amount: z.number(),
  date: z.string(),
  payee: z.string(),
  memo: z.string(),
  createdAt: z.string(),
});

const listResponseSchema = z.object({
  payments: z.array(paymentSchema),
});

const createPaymentSchema = z.object({
  amount: z.coerce.number(),
  date: z.coerce.date().transform((value) => value.toISOString()),
  payee: z.string().min(1),
  memo: z.string().optional(),
});

export async function registerPaymentModule(app: FastifyInstance): Promise<void> {
  app.get(
    "/orgs/:orgId/payments",
    { preHandler: app.authenticate },
    async (request) => {
      const { orgId } = paramsSchema.parse(request.params ?? {});
      const payments = await paymentService.listPaymentsByOrg(orgId);
      return listResponseSchema.parse({ payments });
    },
  );

  app.post(
    "/orgs/:orgId/payments",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { orgId } = paramsSchema.parse(request.params ?? {});
      const body = createPaymentSchema.parse(request.body ?? {});
      const payment = await paymentService.createPayment({
        orgId,
        amount: body.amount,
        date: body.date,
        payee: body.payee,
        memo: body.memo,
      });

      return reply.code(201).send(paymentSchema.parse(payment));
    },
  );
}
