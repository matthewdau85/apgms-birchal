import { z } from "zod";
import {
  cuidSchema,
  isoDateSchema,
  moneyCentsCoerceSchema,
  moneyCentsSchema,
  orgIdSchema,
  positiveIntSchema,
} from "./common";

export const listBankLinesQuerySchema = z.object({
  orgId: orgIdSchema,
  limit: positiveIntSchema.max(200).optional(),
  cursor: z.string().cuid().optional(),
});

export const bankLineSchema = z.object({
  id: cuidSchema,
  orgId: orgIdSchema,
  date: isoDateSchema,
  amountCents: moneyCentsSchema,
  payee: z.string(),
  description: z.string(),
  createdAt: isoDateSchema,
});

export const listBankLinesResponseSchema = z.object({
  bankLines: z.array(bankLineSchema),
  nextCursor: z.string().cuid().nullable(),
});

export const createBankLineBodySchema = z.object({
  orgId: orgIdSchema,
  date: isoDateSchema,
  amountCents: moneyCentsCoerceSchema,
  payee: z.string().min(1),
  description: z.string().min(1),
});

export const createBankLineResponseSchema = z.object({
  bankLine: bankLineSchema,
});
