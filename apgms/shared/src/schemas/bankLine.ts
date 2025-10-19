import { z } from "zod";

export const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string().datetime({ offset: true }),
  amount: z.string(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string().datetime({ offset: true }),
});

export type BankLine = z.infer<typeof bankLineSchema>;

export const bankLineListQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
});

export const bankLineListResponseSchema = z.object({
  lines: z.array(bankLineSchema),
});

export const bankLineCreateBodySchema = z.object({
  orgId: z.string().min(1),
  date: z.string().datetime({ offset: true }),
  amount: z.union([
    z.number(),
    z
      .string()
      .min(1)
      .regex(/^[-+]?\d+(?:\.\d+)?$/, "Amount must be a valid number"),
  ]),
  payee: z.string().min(1),
  desc: z.string().min(1),
});

export const bankLineCreateResponseSchema = z.object({
  line: bankLineSchema,
});

export type BankLineListQuery = z.infer<typeof bankLineListQuerySchema>;
export type BankLineListResponse = z.infer<typeof bankLineListResponseSchema>;
export type BankLineCreateBody = z.infer<typeof bankLineCreateBodySchema>;
export type BankLineCreateResponse = z.infer<typeof bankLineCreateResponseSchema>;
