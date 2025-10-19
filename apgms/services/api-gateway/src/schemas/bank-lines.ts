import { z } from "zod";

export const BankLine = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string().datetime(),
  amountCents: z.number().int().nonnegative(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string().datetime(),
});

export const ListResponse = z.object({
  lines: z.array(BankLine),
});

export const CreateRequest = z.object({
  orgId: z.string(),
  date: z.string().datetime(),
  amountCents: z.number().int(),
  payee: z.string(),
  desc: z.string(),
});

export type BankLineResponse = z.infer<typeof BankLine>;
export type ListResponsePayload = z.infer<typeof ListResponse>;
export type CreateRequestPayload = z.infer<typeof CreateRequest>;
