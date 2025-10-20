import { z } from "zod";

export const bankLineQuerySchema = z
  .object({
    take: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export const bankLineCreateSchema = z
  .object({
    orgId: z.string().min(1, "orgId is required"),
    date: z.coerce.date(),
    amount: z.coerce.number(),
    payee: z.string().min(1, "payee is required"),
    desc: z.string().min(1, "desc is required"),
  })
  .strict();

export const bankLineEntitySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string().datetime(),
  amount: z.number(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string().datetime(),
});

export const bankLineListResponseSchema = z.object({
  lines: z.array(bankLineEntitySchema),
});

export type BankLineResponse = z.infer<typeof bankLineEntitySchema>;

export const serializeBankLine = (line: any): BankLineResponse => {
  const rawAmount = line.amount as unknown;
  const amount =
    typeof rawAmount === "number"
      ? rawAmount
      : rawAmount && typeof (rawAmount as { toNumber?: () => number }).toNumber === "function"
        ? (rawAmount as { toNumber: () => number }).toNumber()
        : Number(rawAmount);

  if (!Number.isFinite(amount)) {
    throw new Error("Unable to serialize bank line amount");
  }

  const date = line.date instanceof Date ? line.date : new Date(line.date);
  const createdAt =
    line.createdAt instanceof Date ? line.createdAt : new Date(line.createdAt);

  return {
    id: String(line.id),
    orgId: String(line.orgId),
    date: date.toISOString(),
    amount,
    payee: String(line.payee),
    desc: String(line.desc),
    createdAt: createdAt.toISOString(),
  } satisfies BankLineResponse;
};
