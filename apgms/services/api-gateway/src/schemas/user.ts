import { z } from "zod";

export const userSummarySchema = z.object({
  email: z.string().email(),
  orgId: z.string().min(1),
  createdAt: z.string(),
});

export const userListResponseSchema = z.object({
  users: z.array(userSummarySchema),
});

export const userSummaryJsonSchema = {
  type: "object",
  properties: {
    email: { type: "string", format: "email" },
    orgId: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["email", "orgId", "createdAt"],
  additionalProperties: false,
} as const;

export const userListResponseJsonSchema = {
  type: "object",
  properties: {
    users: {
      type: "array",
      items: userSummaryJsonSchema,
    },
  },
  required: ["users"],
  additionalProperties: false,
} as const;
