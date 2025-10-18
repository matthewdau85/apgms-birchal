import { z } from "zod";

export const allocationSchema = z.object({
  accountId: z.string().min(1),
  amount: z.number().nonnegative(),
});

export const rptTokenPayloadSchema = z.object({
  orgId: z.string().min(1),
  bankLineId: z.string().min(1),
  policyHash: z.string().min(1),
  allocations: z.array(allocationSchema).min(1),
  prevHash: z.string().min(1).nullable(),
  issuedAt: z.string().min(1),
});

export const rptTokenSchema = z.object({
  id: z.string().min(1),
  hash: z.string().min(1),
  signature: z.string().min(1),
  publicKey: z.string().min(1),
  payload: rptTokenPayloadSchema,
});

export const rptVerificationSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  expectedHash: z.string().optional(),
});

export const rptChainVerificationSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  failedId: z.string().optional(),
  depth: z.number().nonnegative(),
});
