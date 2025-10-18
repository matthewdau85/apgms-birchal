import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("api-gateway"),
  uptime: z.number(),
});

export const healthResponseJsonSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    service: { type: "string" },
    uptime: { type: "number" },
  },
  required: ["ok", "service", "uptime"],
  additionalProperties: false,
} as const;
