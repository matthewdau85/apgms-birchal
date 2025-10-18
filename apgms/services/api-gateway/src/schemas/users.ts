import { z } from "zod";
import { cuid, email, isoDate } from "./common";

export const userSummarySchema = z.object({
  email,
  orgId: cuid,
  createdAt: isoDate,
});

export const listUsersResponseSchema = z.object({
  users: z.array(userSummarySchema),
});

export type UserSummary = z.infer<typeof userSummarySchema>;
export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;
