import pkg from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@apgms/shared/src/db";
import {
  IdempotencyInProgressError,
  withIdempotency,
} from "@apgms/shared/src/idempotency";

const { Prisma } = pkg;

type BankLineResponse = {
  id: string;
  orgId: string;
  date: string;
  amount: string;
  payee: string;
  desc: string;
  createdAt: string;
};

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
});

const createBodySchema = z
  .object({
    date: z
      .string()
      .transform((value, ctx) => {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
          return z.NEVER;
        }
        return parsed;
      }),
    amount: z
      .union([z.number(), z.string()])
      .transform((value, ctx) => {
        try {
          return new Prisma.Decimal(value as PrismaTypes.Decimal.ValueType);
        } catch {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid amount" });
          return z.NEVER;
        }
      }),
    payee: z.string().trim().min(1).max(255),
    desc: z.string().trim().min(1).max(1024),
  })
  .strict();

function serializeBankLine(line: {
  id: string;
  orgId: string;
  date: Date;
  amount: PrismaTypes.Decimal;
  payee: string;
  desc: string;
  createdAt: Date;
}): BankLineResponse {
  return {
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amount: line.amount.toString(),
    payee: line.payee,
    desc: line.desc,
    createdAt: line.createdAt.toISOString(),
  };
}

export default async function bankLinesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/bank-lines", async (request, reply) => {
    const { limit, cursor } = listQuerySchema.parse(request.query ?? {});

    const lines = await prisma.bankLine.findMany({
      where: { orgId: request.org.id },
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (lines.length > limit) {
      const nextLine = lines.pop();
      nextCursor = nextLine ? nextLine.id : null;
    }

    return reply.send({
      data: lines.map(serializeBankLine),
      nextCursor,
    });
  });

  app.post("/v1/bank-lines", async (request, reply) => {
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      return reply.code(400).send({ error: "missing_idempotency_key" });
    }

    const parsedBody = createBodySchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsedBody.error.format() });
    }

    try {
      const { reused, value } = await withIdempotency(
        `${request.org.id}:${idempotencyKey}`,
        async () => {
          const created = await prisma.bankLine.create({
            data: {
              orgId: request.org.id,
              date: parsedBody.data.date,
              amount: parsedBody.data.amount,
              payee: parsedBody.data.payee,
              desc: parsedBody.data.desc,
            },
          });

          const payload = serializeBankLine(created);
          return { statusCode: 201, payload };
        },
      );

      const response = reply.code(value.statusCode);
      if (reused) {
        response.header("x-idempotent-replay", "true");
      }
      return response.send(value.payload);
    } catch (error) {
      if (error instanceof IdempotencyInProgressError) {
        return reply.code(409).send({ error: "idempotency_in_progress" });
      }
      request.log.error(error);
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });
}
