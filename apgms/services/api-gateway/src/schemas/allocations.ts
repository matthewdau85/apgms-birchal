import { z } from "zod";

export const ALLOCATION_LINE_SCHEMA = z.object({
  lineId: z.string().min(1),
  amount: z.number().positive(),
});

export const ALLOCATION_REQUEST_SCHEMA = z.object({
  orgId: z.string().min(1),
  lines: z.array(ALLOCATION_LINE_SCHEMA).min(1),
});

export const ALLOCATION_SPLIT_SCHEMA = z.object({
  category: z.string(),
  amount: z.number(),
  percentage: z.number(),
});

export const ALLOCATION_RESULT_SCHEMA = z.object({
  lineId: z.string(),
  allocations: z.array(ALLOCATION_SPLIT_SCHEMA),
});

export const ALLOCATION_PREVIEW_RESPONSE_SCHEMA = z.object({
  orgId: z.string(),
  totalAmount: z.number(),
  results: z.array(ALLOCATION_RESULT_SCHEMA),
});

export const ALLOCATION_APPLY_RESPONSE_SCHEMA = ALLOCATION_PREVIEW_RESPONSE_SCHEMA.extend({
  committed: z.boolean(),
});
