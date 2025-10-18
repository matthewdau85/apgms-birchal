import { z } from "zod";
import { rptAllocationSchema, rptTokenSchema } from "./rpt.js";

export const previewAllocationsRequestSchema = z.object({
  orgId: z.string(),
  bankLineId: z.string(),
  policy: z.unknown().default({}),
  allocations: z.array(rptAllocationSchema).min(1),
});

export const previewAllocationsResponseSchema = z.object({
  ok: z.literal(true),
  policyHash: z.string(),
  allocations: z.array(rptAllocationSchema),
  explain: z.string(),
});

export const applyAllocationsRequestSchema = previewAllocationsRequestSchema.extend({
  rptId: z.string(),
  timestamp: z.string().optional(),
});

export const applyAllocationsResponseSchema = z.object({
  ok: z.literal(true),
  policyHash: z.string(),
  rpt: z.object({
    token: rptTokenSchema,
    hash: z.string(),
    canonical: z.string(),
  }),
});

export type PreviewAllocationsRequest = z.infer<typeof previewAllocationsRequestSchema>;
export type ApplyAllocationsRequest = z.infer<typeof applyAllocationsRequestSchema>;
