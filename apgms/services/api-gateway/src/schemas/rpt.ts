import { z } from "zod";

export const RptTokenSchema = z.object({
  id: z.string().optional(),
  rptId: z.string(),
  bankLineId: z.string(),
  orgId: z.string(),
  payload: z.unknown(),
  signature: z.string(),
  prevHash: z.string().nullable(),
  hash: z.string(),
  publicKey: z.string(),
  createdAt: z.string().optional(),
});

export const RptResponseSchema = z.object({
  rptId: z.string(),
  tokens: z.array(RptTokenSchema),
  chainValid: z.boolean(),
});

export type RptTokenResponse = z.infer<typeof RptTokenSchema>;
export type RptResponse = z.infer<typeof RptResponseSchema>;
