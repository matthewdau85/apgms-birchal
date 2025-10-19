import { z } from "zod";

export const zBankLineCreateReq = z.object({
  orgId: z.string().min(1, "orgId is required"),
  date: z.string().datetime({ offset: true }),
  amountCents: z
    .number()
    .int("amountCents must be an integer")
    .min(0, "amountCents must be non-negative"),
  payee: z.string().min(1, "payee is required").trim(),
  desc: z.string().min(1, "desc is required").trim(),
});

export const zBankLineRes = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string().datetime({ offset: true }),
  amountCents: z.number().int(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string().datetime({ offset: true }),
});

export const zBankLineListQuery = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
});

export const zBankLineListRes = z.object({
  lines: z.array(zBankLineRes),
});

export type BankLineCreateInput = z.infer<typeof zBankLineCreateReq>;
export type BankLineResponse = z.infer<typeof zBankLineRes>;
