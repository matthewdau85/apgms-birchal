import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { prisma } from "@apgms/shared";

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

const AuditSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  allocationId: z.string().nullable(),
  actor: z.string(),
  action: z.string(),
  details: z.unknown().nullable(),
  createdAt: z.string(),
});

const ResponseSchema = z.object({
  items: z.array(AuditSchema),
});

const ResponseJsonSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "orgId", "allocationId", "actor", "action", "details", "createdAt"],
        properties: {
          id: { type: "string" },
          orgId: { type: "string" },
          allocationId: { type: ["string", "null"] },
          actor: { type: "string" },
          action: { type: "string" },
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

export const auditRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["audit"],
        querystring: QueryJsonSchema,
        response: {
          200: ResponseJsonSchema,
        },
      },
    },
    async (request) => {
      const { orgId, limit } = QuerySchema.parse(request.query);

      const events = await prisma.auditEvent.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return {
        items: events.map((event) => ({
          id: event.id,
          orgId: event.orgId,
          allocationId: event.allocationId ?? null,
          actor: event.actor,
          action: event.action,
          details: event.details ?? null,
          createdAt: event.createdAt.toISOString(),
        })),
      } satisfies z.infer<typeof ResponseSchema>;
    },
  );
};
