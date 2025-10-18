import type { FastifyPluginAsync } from "fastify";
import { getDashboardSummary, type DashboardSummary } from "../services/dashboard.service";
import type { RoutePluginOptions } from "./types";
import { orgQuerystringSchema } from "./types";

const dashboardResponseSchema = {
  type: "object",
  required: ["org", "metrics", "latestAudit"],
  properties: {
    org: {
      type: ["object", "null"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
      required: ["id", "name"],
    },
    metrics: {
      type: "object",
      required: ["userCount", "bankLineTotal", "policyCount", "allocationTotal"],
      properties: {
        userCount: { type: "integer", minimum: 0 },
        bankLineTotal: { type: "number" },
        policyCount: { type: "integer", minimum: 0 },
        allocationTotal: { type: "number" },
      },
    },
    latestAudit: {
      type: ["object", "null"],
      properties: {
        id: { type: "string" },
        actor: { type: "string" },
        action: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
      },
      required: ["id", "actor", "action", "createdAt"],
    },
  },
} as const;

export const dashboardRoutes: FastifyPluginAsync<RoutePluginOptions> = async (fastify, opts) => {
  fastify.get<{ Querystring: { orgId: string }; Reply: DashboardSummary }>(
    "/dashboard",
    {
      schema: {
        querystring: orgQuerystringSchema,
        response: {
          200: dashboardResponseSchema,
        },
      },
    },
    async (request) => {
      return getDashboardSummary(request.query.orgId, opts.prisma);
    },
  );
};
