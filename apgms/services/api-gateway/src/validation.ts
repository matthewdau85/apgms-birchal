import type { BankLine } from "@prisma/client";
import { z, type ZodError } from "zod";

export const getBankLinesQuerySchema = z
  .object({
    take: z.coerce.number().int().min(1).max(200).default(20),
  })
  .strict();

export const createBankLineBodySchema = z
  .object({
    orgId: z.string().min(1, "orgId is required"),
    date: z.coerce.date({ invalid_type_error: "date must be a valid ISO string" }),
    amount: z.coerce.number({ invalid_type_error: "amount must be a number" }),
    payee: z.string().min(1, "payee is required"),
    desc: z.string().min(1, "desc is required"),
  })
  .strict();

export const bankLineResponseSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "date must be an ISO string"),
  amount: z.number(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "createdAt must be an ISO string"),
});

export const getBankLinesResponseSchema = z.object({
  lines: z.array(bankLineResponseSchema),
});

export const createBankLineResponseSchema = bankLineResponseSchema;

export type ValidationErrorBody = {
  error: "validation_error";
  details: ReturnType<ZodError["flatten"]>;
};

export const buildValidationError = (error: ZodError): ValidationErrorBody => ({
  error: "validation_error",
  details: error.flatten(),
});

export const toSerializableBankLine = (line: BankLine) => {
  const amountValue = typeof (line.amount as unknown as { toNumber?: () => number }).toNumber ===
    "function"
    ? (line.amount as unknown as { toNumber: () => number }).toNumber()
    : Number(line.amount);

  return {
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amount: amountValue,
    payee: line.payee,
    desc: line.desc,
    createdAt: line.createdAt.toISOString(),
  } satisfies z.infer<typeof bankLineResponseSchema>;
};
