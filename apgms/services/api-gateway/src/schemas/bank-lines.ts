import { z } from "zod";
import {
  apiErrorSchema,
  cuidSchema,
  isoDateTimeSchema,
  moneyInputSchema,
  moneyOutputSchema,
  paginationQuerySchema,
} from "./common";

export const bankLineSchema = z.object({
  id: cuidSchema,
  orgId: cuidSchema,
  date: isoDateTimeSchema,
  amount: moneyOutputSchema,
  payee: z.string().min(1),
  desc: z.string().min(1),
  createdAt: isoDateTimeSchema,
});

export const bankLineListQuerySchema = paginationQuerySchema.pick({ take: true });

export const bankLineListResponseSchema = z.object({
  lines: z.array(bankLineSchema),
});

export const bankLineCreateBodySchema = z.object({
  orgId: cuidSchema,
  date: isoDateTimeSchema,
  amount: moneyInputSchema,
  payee: z.string().min(1),
  desc: z.string().min(1),
});

export const bankLineCreateResponseSchema = bankLineSchema;

export const bankLineErrorSchema = apiErrorSchema;

export type BankLine = z.infer<typeof bankLineSchema>;
export type BankLineListQuery = z.infer<typeof bankLineListQuerySchema>;
export type BankLineListResponse = z.infer<typeof bankLineListResponseSchema>;
export type BankLineCreateBody = z.infer<typeof bankLineCreateBodySchema>;
export type BankLineCreateResponse = z.infer<typeof bankLineCreateResponseSchema>;
