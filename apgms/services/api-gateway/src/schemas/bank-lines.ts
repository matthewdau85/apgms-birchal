import { z } from "zod";
import { cuid, isoDate, moneyCents } from "./common";

export const bankLineSchema = z.object({
  id: cuid,
  orgId: cuid,
  date: isoDate,
  amountCents: moneyCents,
  payee: z.string().min(1),
  desc: z.string().min(1),
  createdAt: isoDate,
});

export const listBankLinesResponseSchema = z.object({
  lines: z.array(bankLineSchema),
});

export const createBankLineRequestSchema = z.object({
  orgId: cuid,
  date: isoDate,
  amountCents: moneyCents,
  payee: z.string().min(1),
  desc: z.string().min(1),
});

export const createBankLineResponseSchema = bankLineSchema;

export type BankLine = z.infer<typeof bankLineSchema>;
export type ListBankLinesResponse = z.infer<typeof listBankLinesResponseSchema>;
export type CreateBankLineRequest = z.infer<typeof createBankLineRequestSchema>;
export type CreateBankLineResponse = z.infer<typeof createBankLineResponseSchema>;
