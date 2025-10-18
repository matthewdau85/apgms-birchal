import { z } from "zod";

const decimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "Invalid decimal format");

export const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string().datetime(),
  amount: decimalString,
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string().datetime(),
});

export const listBankLinesQuerySchema = z
  .object({
    take: z
      .union([z.string(), z.number()])
      .transform((value) => Number(value))
      .pipe(z.number().int().positive().max(200))
      .optional(),
  })
  .strict(false);

export const listBankLinesResponseSchema = z.object({
  lines: z.array(bankLineSchema),
});

export const createBankLineBodySchema = z.object({
  orgId: z.string(),
  date: z.string().datetime(),
  amount: z.union([z.number(), decimalString]).transform((value) =>
    typeof value === "number" ? value.toString() : value,
  ),
  payee: z.string(),
  desc: z.string(),
});

export const createBankLineResponseSchema = bankLineSchema;

export type ListBankLinesResponse = z.infer<typeof listBankLinesResponseSchema>;
export type CreateBankLineBody = z.infer<typeof createBankLineBodySchema>;
export type CreateBankLineResponse = z.infer<typeof createBankLineResponseSchema>;
