import { z } from "zod";

export const zOrgProfile = z.object({
  legalName: z.string().min(1, "Legal name is required"),
  abn: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  contactEmail: z.string().email("A valid contact email is required"),
});

export type OrgProfileInput = z.infer<typeof zOrgProfile>;

export const zBank = z.object({
  bsb: z
    .string()
    .regex(/^[0-9]{6}$/u, "BSB must be 6 digits"),
  acc: z
    .string()
    .regex(/^[0-9]{6,9}$/u, "Account number must be 6-9 digits"),
});

export type BankInput = z.infer<typeof zBank>;

export const zPolicySelect = z.object({
  policyId: z.string().min(1, "Policy is required"),
});

export type PolicySelectInput = z.infer<typeof zPolicySelect>;
