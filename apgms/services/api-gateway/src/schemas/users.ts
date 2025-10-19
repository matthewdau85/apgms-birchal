import { z } from "zod";
import { cuidSchema, emailSchema, isoDateSchema, orgIdSchema, positiveIntSchema } from "./common";

export const getUsersQuerySchema = z.object({
  orgId: orgIdSchema,
  limit: positiveIntSchema.max(200).optional(),
  cursor: z.string().cuid().optional(),
});

export const userSchema = z.object({
  id: cuidSchema,
  email: emailSchema,
  orgId: orgIdSchema,
  createdAt: isoDateSchema,
});

export const getUsersResponseSchema = z.object({
  users: z.array(userSchema),
  nextCursor: z.string().cuid().nullable(),
});
