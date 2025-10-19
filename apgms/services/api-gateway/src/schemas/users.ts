import { z } from "zod";

export const listUsersResponseSchema = z.object({
  users: z.array(
    z.object({
      email: z.string().email(),
      orgId: z.string(),
      createdAt: z.string().datetime(),
    }),
  ),
});

export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;
