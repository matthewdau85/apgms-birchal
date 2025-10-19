import { z } from "zod";
import { zDateISO, zId, zMoneyCents, zOrgId } from "./common.js";

export const bankLineSchema = z.object({
  id: zId,
  orgId: zOrgId,
  date: zDateISO,
  amountCents: zMoneyCents,
  payee: z.string(),
  desc: z.string(),
  createdAt: zDateISO,
});

export const listBankLinesQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
  cursor: zId.optional(),
});

export const listBankLinesResponseSchema = z.object({
  lines: z.array(bankLineSchema),
  nextCursor: zId.nullable(),
});

export const createBankLineBodySchema = z.object({
  orgId: zOrgId,
  date: z.coerce.date(),
  amountCents: zMoneyCents,
  payee: z.string().min(1),
  desc: z.string().min(1),
});

export const createBankLineResponseSchema = bankLineSchema;

export type ListBankLinesQuery = z.infer<typeof listBankLinesQuerySchema>;
export type ListBankLinesResponse = z.infer<typeof listBankLinesResponseSchema>;
export type CreateBankLineBody = z.infer<typeof createBankLineBodySchema>;
export type CreateBankLineResponse = z.infer<typeof createBankLineResponseSchema>;
