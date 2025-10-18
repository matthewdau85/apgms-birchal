import { z } from "zod";

export const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string(),
  amount: z.union([z.string(), z.number()]),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string(),
});

export const bankLinesResponseSchema = z.object({
  lines: z.array(bankLineSchema),
});

export const createBankLineResponseSchema = bankLineSchema;

export const dashboardResponseSchema = z.object({}).passthrough();

export const responseSchemaRegistry: Record<string, z.ZodTypeAny> = {
  "GET /bank-lines": bankLinesResponseSchema,
  "POST /bank-lines": createBankLineResponseSchema,
  "GET /dashboard": dashboardResponseSchema,
};
