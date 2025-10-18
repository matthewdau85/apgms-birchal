import { z } from "zod";
import { zId, zOrgId, zMoneyCents, zIsoDate } from "./common";

export const createBankLineBodySchema = z.object({
  orgId: zOrgId,
  date: zIsoDate,
  amountCents: zMoneyCents,
  payee: z.string().min(1),
  desc: z.string().min(1),
});

export type CreateBankLineBody = z.infer<typeof createBankLineBodySchema>;

export const bankLineResponseSchema = z.object({
  id: zId,
  orgId: zOrgId,
  date: zIsoDate,
  amountCents: zMoneyCents,
  payee: z.string(),
  desc: z.string(),
  createdAt: zIsoDate,
});

export type BankLineResponse = z.infer<typeof bankLineResponseSchema>;

export const listBankLinesQuerySchema = z.object({
  take: z
    .coerce.number()
    .int()
    .min(1)
    .max(200)
    .optional(),
});

export type ListBankLinesQuery = z.infer<typeof listBankLinesQuerySchema>;

export const listBankLinesResponseSchema = z.object({
  lines: z.array(bankLineResponseSchema),
});

export type ListBankLinesResponse = z.infer<typeof listBankLinesResponseSchema>;
