import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { prisma } from "@apgms/shared";
import { AllocationStatus, AllocationStatusValues } from "../lib/constants";
import { toDecimalString } from "../lib/format";

const allocationStatusEnum = AllocationStatusValues;

const QuerySchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  status: z.nativeEnum(AllocationStatus).optional(),
});

const QueryJsonSchema = {
  type: "object",
  required: ["orgId"],
  additionalProperties: false,
  properties: {
    orgId: { type: "string", minLength: 1 },
    status: { type: "string", enum: allocationStatusEnum },
  },
} as const;

const AllocationSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  amount: z.string(),
  status: z.nativeEnum(AllocationStatus),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  bankLine: z
    .object({
      id: z.string(),
      date: z.string(),
      amount: z.string(),
      payee: z.string(),
      description: z.string(),
    })
    .nullable(),
  designatedAccount: z
    .object({
      id: z.string(),
      name: z.string(),
      bsb: z.string(),
      accountNumber: z.string(),
    })
    .nullable(),
});

const ResponseSchema = z.object({
  items: z.array(AllocationSchema),
});

const ResponseJsonSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        required: [
          "id",
          "orgId",
          "amount",
          "status",
          "notes",
          "createdAt",
          "updatedAt",
          "bankLine",
          "designatedAccount",
        ],
        properties: {
          id: { type: "string" },
          orgId: { type: "string" },
          amount: { type: "string" },
          status: { type: "string", enum: allocationStatusEnum },
          notes: { type: ["string", "null"] },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
          bankLine: {
            type: ["object", "null"],
            properties: {
              id: { type: "string" },
              date: { type: "string" },
              amount: { type: "string" },
              payee: { type: "string" },
              description: { type: "string" },
            },
            required: ["id", "date", "amount", "payee", "description"],
          },
          designatedAccount: {
            type: ["object", "null"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              bsb: { type: "string" },
              accountNumber: { type: "string" },
            },
            required: ["id", "name", "bsb", "accountNumber"],
          },
        },
      },
    },
  },
} as const;

export const allocationsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["allocations"],
        querystring: QueryJsonSchema,
        response: {
          200: ResponseJsonSchema,
        },
      },
    },
    async (request) => {
      const { orgId, status } = QuerySchema.parse(request.query);

      const allocations = await prisma.allocation.findMany({
        where: {
          orgId,
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          bankLine: true,
          designatedAccount: true,
        },
      });

      return {
        items: allocations.map((allocation) => ({
          id: allocation.id,
          orgId: allocation.orgId,
          amount: toDecimalString(allocation.amount),
          status: allocation.status,
          notes: allocation.notes ?? null,
          createdAt: allocation.createdAt.toISOString(),
          updatedAt: allocation.updatedAt.toISOString(),
          bankLine: allocation.bankLine
            ? {
                id: allocation.bankLine.id,
                date: allocation.bankLine.date.toISOString(),
                amount: toDecimalString(allocation.bankLine.amount),
                payee: allocation.bankLine.payee,
                description: allocation.bankLine.desc,
              }
            : null,
          designatedAccount: allocation.designatedAccount
            ? {
                id: allocation.designatedAccount.id,
                name: allocation.designatedAccount.name,
                bsb: allocation.designatedAccount.bsb,
                accountNumber: allocation.designatedAccount.accountNumber,
              }
            : null,
        })),
      } satisfies z.infer<typeof ResponseSchema>;
    },
  );
};
