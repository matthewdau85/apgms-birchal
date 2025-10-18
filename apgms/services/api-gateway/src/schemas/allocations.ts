import { z } from "zod";

const moneySchema = z.object({
  currency: z.string().min(3).max(3),
  value: z.string(),
});

export const allocationSchema = z.object({
  allocationId: z.string(),
  ledgerAccountId: z.string(),
  ledgerAccountName: z.string(),
  direction: z.enum(["debit", "credit"]),
  amount: moneySchema,
  memo: z.string().optional(),
});

export const allocationsPreviewRequestSchema = z.object({
  orgId: z.string(),
  bankLineId: z.string(),
  policyHash: z.string(),
});

export const allocationsPreviewResponseSchema = z.object({
  orgId: z.string(),
  bankLineId: z.string(),
  policyHash: z.string(),
  prevHash: z.string(),
  allocations: z.array(allocationSchema),
  totals: z.object({
    debit: moneySchema,
    credit: moneySchema,
  }),
});

export const allocationsApplyRequestSchema = z.object({
  orgId: z.string(),
  bankLineId: z.string(),
  policyHash: z.string(),
  allocations: z.array(allocationSchema),
  prevHash: z.string(),
});

export const allocationsApplyResponseSchema = z.object({
  rptId: z.string(),
});

export type AllocationsPreviewRequest = z.infer<typeof allocationsPreviewRequestSchema>;
export type AllocationsPreviewResponse = z.infer<typeof allocationsPreviewResponseSchema>;
export type AllocationsApplyRequest = z.infer<typeof allocationsApplyRequestSchema>;
export type AllocationsApplyResponse = z.infer<typeof allocationsApplyResponseSchema>;
