import type { FastifyPluginAsync } from "fastify";
import { getAllocations, type AllocationItem } from "../services/allocations.service";
import type { RoutePluginOptions } from "./types";
import { orgQuerystringSchema } from "./types";

const allocationItemSchema = {
  type: "object",
  required: ["id", "orgId", "portfolio", "amount", "currency", "updatedAt"],
  properties: {
    id: { type: "string" },
    orgId: { type: "string" },
    portfolio: { type: "string" },
    amount: { type: "number" },
    currency: { type: "string" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const allocationsResponseSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: allocationItemSchema,
    },
  },
} as const;

export const allocationRoutes: FastifyPluginAsync<RoutePluginOptions> = async (fastify, opts) => {
  fastify.get<{ Querystring: { orgId: string }; Reply: { items: AllocationItem[] } }>(
    "/allocations",
    {
      schema: {
        querystring: orgQuerystringSchema,
        response: {
          200: allocationsResponseSchema,
        },
      },
    },
    async (request) => ({
      items: await getAllocations(request.query.orgId, opts.prisma),
    }),
  );
};
