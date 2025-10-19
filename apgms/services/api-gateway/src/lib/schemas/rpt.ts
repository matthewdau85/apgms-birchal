import { z } from "zod";
import { allocationsRequestSchema } from "./allocations";

export const rptPayloadSchema = allocationsRequestSchema
  .extend({
    now: allocationsRequestSchema.shape.now.default(() => new Date().toISOString()),
  })
  .transform((payload) => ({
    ...payload,
    prevHash: payload.prevHash ?? null,
  }));

export const rptTokenSchema = z.object({
  hash: z.string().min(1),
  payload: rptPayloadSchema,
  signature: z.string().min(1),
  publicKey: z.string().min(1),
});

export type RptPayload = z.infer<typeof rptPayloadSchema>;
export type RptToken = z.infer<typeof rptTokenSchema>;
