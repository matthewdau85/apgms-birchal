import { z } from "zod";

export const allocationSchema = z.object({
  bucket: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  currency: z.literal("AUD"),
});

export const rptTokenSchema = z.object({
  rptId: z.string().min(1),
  orgId: z.string().min(1),
  bankLineId: z.string().min(1),
  policyHash: z.string().min(1),
  allocations: z.array(allocationSchema),
  prevHash: z.string().min(1).nullable(),
  timestamp: z.string().min(1),
  digest: z.string().min(1),
  signature: z.string().min(1),
  publicKey: z.string().min(1),
});

export const rptVerificationResponseSchema = z.object({
  rptId: z.string().min(1),
  signatureValid: z.boolean(),
  chain: z.object({
    ok: z.boolean(),
    depth: z.number().int().nonnegative(),
    error: z.string().optional(),
    failingRptId: z.string().optional(),
  }),
  rpt: rptTokenSchema.optional(),
});

export type Allocation = z.infer<typeof allocationSchema>;
export type RptToken = z.infer<typeof rptTokenSchema>;
export type RptVerificationResponse = z.infer<typeof rptVerificationResponseSchema>;
