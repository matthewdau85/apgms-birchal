import { z } from "zod";

export const rptAllocationSchema = z.object({
  allocationId: z.string(),
  amountCents: z.number().int(),
  memo: z.string().optional(),
});

export const rptTokenSchema = z.object({
  rptId: z.string(),
  orgId: z.string(),
  bankLineId: z.string(),
  policyHash: z.string(),
  allocations: z.array(rptAllocationSchema),
  prevHash: z.string().nullable(),
  sig: z.string(),
  timestamp: z.string(),
});

export const verifyRptResponseSchema = z.object({
  ok: z.boolean(),
  verified: z.boolean().optional(),
  hash: z.string().optional(),
  reason: z.string().optional(),
});

export type RptAllocationInput = z.infer<typeof rptAllocationSchema>;
export type RptTokenInput = z.infer<typeof rptTokenSchema>;
