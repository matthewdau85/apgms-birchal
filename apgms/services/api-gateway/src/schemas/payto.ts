import { z } from "zod";

export const createAgreementSchema = z.object({
  orgId: z.string().min(1),
  payeeName: z.string().min(1),
  bsb: z.string().regex(/^[0-9]{6}$/),
  acc: z.string().min(4).max(20),
});

export const remitSchema = z.object({
  agreementId: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.literal("AUD"),
});

export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;
export type RemitInput = z.infer<typeof remitSchema>;
