import { z } from "zod";

const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string().datetime(),
  amount: z.string(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string().datetime(),
});

export const listBankLinesQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
});

export const listBankLinesResponseSchema = z.object({
  lines: z.array(bankLineSchema),
});

export const createBankLineRequestSchema = z.object({
  orgId: z.string().min(1),
  date: z.coerce.date(),
  amount: z.coerce.number(),
  payee: z.string().min(1),
  desc: z.string().min(1),
});

export const createBankLineResponseSchema = bankLineSchema;

export type ListBankLinesQuery = z.infer<typeof listBankLinesQuerySchema>;
export type ListBankLinesResponse = z.infer<typeof listBankLinesResponseSchema>;
export type CreateBankLineRequest = z.infer<typeof createBankLineRequestSchema>;
export type CreateBankLineResponse = z.infer<typeof createBankLineResponseSchema>;
