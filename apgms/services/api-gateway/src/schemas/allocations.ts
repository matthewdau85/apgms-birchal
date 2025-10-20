import { z } from "zod";

const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/u, "Invalid ISO currency code");

const monetaryAmountSchema = z.number().finite();

const allocationLineInputSchema = z.object({
  allocationId: z.string().min(1),
  bankLineId: z.string().min(1),
  amount: monetaryAmountSchema,
  currency: currencyCodeSchema,
  gstCode: z.string().min(1),
  description: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export const allocationSummarySchema = z.object({
  currency: currencyCodeSchema,
  totalAllocations: z.number().int().nonnegative(),
  totalAmount: monetaryAmountSchema,
  gstAmount: monetaryAmountSchema,
});

export const allocationsPreviewRequestSchema = z.object({
  orgId: z.string().min(1),
  allocations: z.array(allocationLineInputSchema).min(1),
});

const allocationPreviewLineSchema = allocationLineInputSchema.extend({
  status: z.enum(["proposed", "confirmed"]).default("proposed"),
});

export const allocationsPreviewResponseSchema = z.object({
  previewId: z.string().min(1),
  orgId: z.string().min(1),
  generatedAt: z.string().datetime(),
  allocations: z.array(allocationPreviewLineSchema),
  summary: allocationSummarySchema,
});

export const allocationsApplyRequestSchema = z.object({
  previewId: z.string().min(1),
  orgId: z.string().min(1),
  allocations: z
    .array(
      z.object({
        allocationId: z.string().min(1),
        bankLineId: z.string().min(1),
      })
    )
    .min(1),
});

export const allocationsApplyResponseSchema = z.object({
  rptId: z.string().min(1),
  summary: allocationSummarySchema,
});

export type AllocationsPreviewRequest = z.infer<typeof allocationsPreviewRequestSchema>;
export type AllocationsPreviewResponse = z.infer<typeof allocationsPreviewResponseSchema>;
export type AllocationsApplyRequest = z.infer<typeof allocationsApplyRequestSchema>;
export type AllocationsApplyResponse = z.infer<typeof allocationsApplyResponseSchema>;
