import type { FastifyPluginAsync } from "fastify";
import { getAuditLog, type AuditEntry } from "../services/audit.service";
import type { RoutePluginOptions } from "./types";
import { orgQuerystringSchema } from "./types";

const auditEntrySchema = {
  type: "object",
  required: ["id", "orgId", "actor", "action", "createdAt"],
  properties: {
    id: { type: "string" },
    orgId: { type: "string" },
    actor: { type: "string" },
    action: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    details: {},
  },
} as const;

const auditResponseSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: auditEntrySchema,
    },
  },
} as const;

export const auditRoutes: FastifyPluginAsync<RoutePluginOptions> = async (fastify, opts) => {
  fastify.get<{ Querystring: { orgId: string }; Reply: { items: AuditEntry[] } }>(
    "/audit",
    {
      schema: {
        querystring: orgQuerystringSchema,
        response: {
          200: auditResponseSchema,
        },
      },
    },
    async (request) => ({
      items: await getAuditLog(request.query.orgId, opts.prisma),
    }),
  );
};
