import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { prisma } from "@apgms/shared";
import { AllocationStatus } from "../lib/constants";
import { toDecimalString } from "../lib/format";

const QuerySchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
});

const QueryJsonSchema = {
  type: "object",
  required: ["orgId"],
  additionalProperties: false,
  properties: {
    orgId: { type: "string", minLength: 1 },
  },
} as const;

const DashboardResponseSchema = z.object({
  org: z.object({
    id: z.string(),
    name: z.string(),
  }),
  totals: z.object({
    bankLineCount: z.number(),
    bankLineAmount: z.string(),
    pendingAllocations: z.number(),
    designatedAccountCount: z.number(),
  }),
  recentActivity: z.array(
    z.object({
      id: z.string(),
      actor: z.string(),
      action: z.string(),
      allocationId: z.string().nullable(),
      details: z.unknown().nullable(),
      createdAt: z.string(),
    }),
  ),
});

const DashboardResponseJsonSchema = {
  type: "object",
  required: ["org", "totals", "recentActivity"],
  properties: {
    org: {
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
    },
    totals: {
      type: "object",
      required: ["bankLineCount", "bankLineAmount", "pendingAllocations", "designatedAccountCount"],
      properties: {
        bankLineCount: { type: "integer" },
        bankLineAmount: { type: "string" },
        pendingAllocations: { type: "integer" },
        designatedAccountCount: { type: "integer" },
      },
    },
    recentActivity: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "actor", "action", "allocationId", "details", "createdAt"],
        properties: {
          id: { type: "string" },
          actor: { type: "string" },
          action: { type: "string" },
          allocationId: { type: ["string", "null"] },
          details: {
            anyOf: [
              { type: "object", additionalProperties: true },
              { type: "array" },
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "null" }
            ],
          },
          createdAt: { type: "string" },
        },
      },
    },
  },
} as const;

const ErrorJsonSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string" },
  },
} as const;

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["dashboard"],
        querystring: QueryJsonSchema,
        response: {
          200: DashboardResponseJsonSchema,
          404: ErrorJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const { orgId } = QuerySchema.parse(request.query);

      const org = await prisma.org.findUnique({
        where: { id: orgId },
        select: { id: true, name: true },
      });

      if (!org) {
        return reply.status(404).send({ error: "org_not_found" });
      }

      const bankLines = await prisma.bankLine.aggregate({
        where: { orgId },
        _count: { _all: true },
        _sum: { amount: true },
      });

      const pendingAllocations = await prisma.allocation.count({
        where: { orgId, status: AllocationStatus.PENDING },
      });

      const designatedAccountCount = await prisma.designatedAccount.count({
        where: { orgId },
      });

      const recentActivity = await prisma.auditEvent.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      return {
        org,
        totals: {
          bankLineCount: bankLines._count._all,
          bankLineAmount: toDecimalString(bankLines._sum.amount),
          pendingAllocations,
          designatedAccountCount,
        },
        recentActivity: recentActivity.map((event) => ({
          id: event.id,
          actor: event.actor,
          action: event.action,
          allocationId: event.allocationId ?? null,
          details: event.details ?? null,
          createdAt: event.createdAt.toISOString(),
        })),
      } satisfies z.infer<typeof DashboardResponseSchema>;
    },
  );
};
