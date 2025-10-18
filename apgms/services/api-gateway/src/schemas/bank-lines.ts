import { z } from "zod";

export const BANK_LINE_SCHEMA = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string(),
  amount: z.number(),
  payee: z.string(),
  description: z.string(),
});

export const BANK_LINE_QUERY_SCHEMA = z.object({
  take: z.number().int().min(1).max(200).default(20),
  cursor: z.string().optional(),
});

export const BANK_LINE_CREATE_SCHEMA = z.object({
  orgId: z.string().min(1),
  date: z.string().min(1),
  amount: z.number(),
  payee: z.string().min(1),
  description: z.string().min(1),
});

export const BANK_LINE_LIST_SCHEMA = z.object({
  items: z.array(BANK_LINE_SCHEMA),
  nextCursor: z.string().nullable(),
});
