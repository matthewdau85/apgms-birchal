import { z } from "zod";

import { allocationSchema } from "./allocations";

export const rptParamsSchema = z.object({
  id: z.string(),
});

export const rptResponseSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  bankLineId: z.string(),
  policyHash: z.string(),
  prevHash: z.string(),
  allocations: z.array(allocationSchema),
  totals: z.object({
    debit: z.object({
      currency: z.string().min(3).max(3),
      value: z.string(),
    }),
    credit: z.object({
      currency: z.string().min(3).max(3),
      value: z.string(),
    }),
  }),
  status: z.enum(["preview", "applied"]),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type RptParams = z.infer<typeof rptParamsSchema>;
export type RptResponse = z.infer<typeof rptResponseSchema>;
