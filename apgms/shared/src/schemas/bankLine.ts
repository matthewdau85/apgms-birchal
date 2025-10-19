import { z } from "zod";

const decimalRegex = /^-?\d+(?:\.\d+)?$/;

const Amount = z
  .union([
    z.number(),
    z.string().regex(decimalRegex, "amount must be a decimal string"),
  ])
  .transform((value) => value.toString());

const BankLineBase = z.object({
  orgId: z.string().min(1, "orgId is required"),
  date: z.coerce.date(),
  amount: Amount,
  payee: z.string().min(1, "payee is required"),
  desc: z.string().min(1, "desc is required"),
});

export const BankLineCreate = BankLineBase;

export const BankLineUpdate = BankLineBase.partial().refine(
  (value) => Object.keys(value).length > 0,
  "at least one field must be provided",
);

export const BankLineOut = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string().datetime(),
  amount: z.string(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string().datetime(),
});

export type BankLineCreateInput = z.infer<typeof BankLineCreate>;
export type BankLineUpdateInput = z.infer<typeof BankLineUpdate>;
export type BankLineOutput = z.infer<typeof BankLineOut>;
