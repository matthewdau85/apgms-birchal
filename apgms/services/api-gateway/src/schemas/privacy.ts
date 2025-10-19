import { z } from "zod";

export const PrivacyAdminRequestSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  subjectEmail: z.string().email("subjectEmail must be a valid email"),
});

export type PrivacyAdminRequest = z.infer<typeof PrivacyAdminRequestSchema>;
