import { z } from "zod";
import { allocationSchema, rptTokenSchema, rptChainVerificationSchema, rptVerificationSchema } from "./rpt.js";

export const previewAllocationsRequestSchema = z.object({
  orgId: z.string().min(1),
  bankLineId: z.string().min(1),
});

export const previewAllocationsResponseSchema = z.object({
  policyHash: z.string().min(1),
  allocations: z.array(allocationSchema),
});

export const applyAllocationsRequestSchema = previewAllocationsRequestSchema.extend({
  now: z.coerce.date().optional(),
});

export const applyAllocationsResponseSchema = z.object({
  rptToken: rptTokenSchema,
  verification: rptVerificationSchema,
  chain: rptChainVerificationSchema,
});
