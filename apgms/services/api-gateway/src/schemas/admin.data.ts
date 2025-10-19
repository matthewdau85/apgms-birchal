import { z } from "zod";

export const adminDataDeleteRequestSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  email: z.string().email("email must be valid"),
  confirm: z.literal("DELETE"),
});

export const adminDataDeleteResponseSchema = z.object({
  action: z.union([z.literal("anonymized"), z.literal("deleted")]),
  userId: z.string().min(1),
  occurredAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "occurredAt must be ISO string",
    }),
});

export type AdminDataDeleteRequest = z.infer<typeof adminDataDeleteRequestSchema>;
export type AdminDataDeleteResponse = z.infer<typeof adminDataDeleteResponseSchema>;
