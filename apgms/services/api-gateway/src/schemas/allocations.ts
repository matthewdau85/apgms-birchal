import { z } from "zod";
import {
  cuidSchema,
  isoDateTimeSchema,
  moneyInputSchema,
  moneyOutputSchema,
} from "./common";

export const allocationEntrySchema = z.object({
  bankLineId: cuidSchema,
  accountId: cuidSchema,
  amount: moneyInputSchema,
});

export const allocationPreviewRequestSchema = z.object({
  orgId: cuidSchema,
  allocations: z.array(allocationEntrySchema).min(1),
});

export const allocationPreviewResponseSchema = z.object({
  orgId: cuidSchema,
  totalAllocated: moneyOutputSchema,
  allocations: z.array(
    allocationEntrySchema.extend({
      amount: moneyOutputSchema,
      remaining: moneyOutputSchema.optional(),
    })
  ),
});

export const allocationApplyRequestSchema = allocationPreviewRequestSchema.extend({
  appliedBy: cuidSchema,
});

export const allocationApplyResponseSchema = z.object({
  allocationBatchId: cuidSchema,
  appliedAt: isoDateTimeSchema,
  allocations: z.array(
    allocationEntrySchema.extend({
      amount: moneyOutputSchema,
      status: z.enum(["applied", "failed"]),
      message: z.string().optional(),
    })
  ),
});

export type AllocationEntry = z.infer<typeof allocationEntrySchema>;
export type AllocationPreviewRequest = z.infer<typeof allocationPreviewRequestSchema>;
export type AllocationPreviewResponse = z.infer<typeof allocationPreviewResponseSchema>;
export type AllocationApplyRequest = z.infer<typeof allocationApplyRequestSchema>;
export type AllocationApplyResponse = z.infer<typeof allocationApplyResponseSchema>;
