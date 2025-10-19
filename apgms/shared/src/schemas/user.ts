import { z } from "zod";

export const userSummarySchema = z.object({
  email: z.string().email(),
  orgId: z.string(),
  createdAt: z.string().datetime({ offset: true }),
});

export const listUsersResponseSchema = z.object({
  users: z.array(userSummarySchema),
});

export type UserSummary = z.infer<typeof userSummarySchema>;
export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;
