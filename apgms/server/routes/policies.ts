import type { FastifyPluginAsync } from "fastify";
import { getPolicies, type PolicyItem } from "../services/policies.service";
import type { RoutePluginOptions } from "./types";
import { orgQuerystringSchema } from "./types";

const policyItemSchema = {
  type: "object",
  required: ["id", "orgId", "name", "status", "premium", "effectiveDate"],
  properties: {
    id: { type: "string" },
    orgId: { type: "string" },
    name: { type: "string" },
    status: { type: "string" },
    premium: { type: "number" },
    effectiveDate: { type: "string", format: "date-time" },
  },
} as const;

const policiesResponseSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: policyItemSchema,
    },
  },
} as const;

export const policiesRoutes: FastifyPluginAsync<RoutePluginOptions> = async (fastify, opts) => {
  fastify.get<{ Querystring: { orgId: string }; Reply: { items: PolicyItem[] } }>(
    "/policies",
    {
      schema: {
        querystring: orgQuerystringSchema,
        response: {
          200: policiesResponseSchema,
        },
      },
    },
    async (request) => ({
      items: await getPolicies(request.query.orgId, opts.prisma),
    }),
  );
};
