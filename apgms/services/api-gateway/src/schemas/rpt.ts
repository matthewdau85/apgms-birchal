import { z } from "zod";
import { allocationSummarySchema } from "./allocations";

const allocationLineSchema = z.object({
  allocationId: z.string().min(1),
  bankLineId: z.string().min(1),
  amount: z.number().finite(),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/u, "Invalid ISO currency code"),
  gstCode: z.string().min(1),
  description: z.string().min(1),
});

export const rptParamsSchema = z.object({
  id: z.string().min(1),
});

export const rptResponseSchema = z.object({
  rptId: z.string().min(1),
  orgId: z.string().min(1),
  mintedAt: z.string().datetime(),
  summary: allocationSummarySchema,
  allocations: z.array(allocationLineSchema),
});

export type RptParams = z.infer<typeof rptParamsSchema>;
export type RptResponse = z.infer<typeof rptResponseSchema>;
