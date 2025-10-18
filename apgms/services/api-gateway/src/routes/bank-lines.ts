import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../../../shared/src/db";
import { auth } from "../mw/auth";
import { idempotency } from "../mw/idempotency";
import { orgScope } from "../mw/org-scope";
import { validateBody } from "../mw/validate";

const bankLineBodySchema = z.object({
  orgId: z.string().min(1),
  date: z.string().min(1),
  amount: z.union([z.number(), z.string().min(1)]),
  payee: z.string().min(1),
  desc: z.string().min(1),
});

type BankLineBody = z.infer<typeof bankLineBodySchema>;

export const registerBankLineRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as Record<string, unknown>)?.take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
  });

  app.post<{
    Body: BankLineBody;
  }>(
    "/bank-lines",
    {
      preHandler: [auth(), orgScope(), validateBody(bankLineBodySchema), idempotency()],
    },
    async (req: FastifyRequest<{ Body: BankLineBody }>, reply: FastifyReply) => {
      const body = req.body;

      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
      });

      reply.code(201).send(created);
    },
  );
};
