import { z } from "zod";

export const authTokenSchema = z.object({
  sub: z.string().min(1, "missing subject"),
  email: z.string().email("invalid email claim"),
  orgId: z.string().min(1, "missing orgId"),
  roles: z.array(z.string().min(1)).default([]),
});

export type AuthTokenClaims = z.infer<typeof authTokenSchema>;
