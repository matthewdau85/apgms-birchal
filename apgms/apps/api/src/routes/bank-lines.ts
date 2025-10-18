import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { prisma } from "@apgms/shared";
import { AllocationStatus, AllocationStatusValues } from "../lib/constants";
import { toDecimalString } from "../lib/format";

const QuerySchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const QueryJsonSchema = {
  type: "object",
  required: ["orgId"],
  additionalProperties: false,
  properties: {
    orgId: { type: "string", minLength: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
} as const;

const allocationStatusEnum = AllocationStatusValues;

const AllocationSchema = z.object({
  id: z.string(),
  amount: z.string(),
  status: z.nativeEnum(AllocationStatus),
  notes: z.string().nullable(),
  designatedAccountId: z.string().nullable(),
  bankLineId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const BankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string(),
  amount: z.string(),
  payee: z.string(),
  description: z.string(),
  createdAt: z.string(),
  allocations: z.array(AllocationSchema),
});

const ResponseSchema = z.object({
  items: z.array(BankLineSchema),
});

const ResponseJsonSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "orgId", "date", "amount", "payee", "description", "createdAt", "allocations"],
        properties: {
          id: { type: "string" },
          orgId: { type: "string" },
          date: { type: "string" },
          amount: { type: "string" },
          payee: { type: "string" },
          description: { type: "string" },
          createdAt: { type: "string" },
          allocations: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "amount", "status", "notes", "designatedAccountId", "bankLineId", "createdAt", "updatedAt"],
              properties: {
                id: { type: "string" },
                amount: { type: "string" },
                status: { type: "string", enum: allocationStatusEnum },
                notes: { type: ["string", "null"] },
                designatedAccountId: { type: ["string", "null"] },
                bankLineId: { type: ["string", "null"] },
                createdAt: { type: "string" },
                updatedAt: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const bankLinesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["bank-lines"],
        querystring: QueryJsonSchema,
        response: {
          200: ResponseJsonSchema,
        },
      },
    },
    async (request) => {
      const { orgId, limit } = QuerySchema.parse(request.query);

      const bankLines = await prisma.bankLine.findMany({
        where: { orgId },
        orderBy: { date: "desc" },
        take: limit,
        include: {
          allocations: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      return {
        items: bankLines.map((line) => ({
          id: line.id,
          orgId: line.orgId,
          date: line.date.toISOString(),
          amount: toDecimalString(line.amount),
          payee: line.payee,
          description: line.desc,
          createdAt: line.createdAt.toISOString(),
          allocations: line.allocations.map((allocation) => ({
            id: allocation.id,
            amount: toDecimalString(allocation.amount),
            status: allocation.status,
            notes: allocation.notes ?? null,
            designatedAccountId: allocation.designatedAccountId ?? null,
            bankLineId: allocation.bankLineId ?? null,
            createdAt: allocation.createdAt.toISOString(),
            updatedAt: allocation.updatedAt.toISOString(),
          })),
        })),
      } satisfies z.infer<typeof ResponseSchema>;
    },
  );
};
