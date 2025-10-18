import { z } from "zod";

export const transferStatusEnum = z.enum(["PENDING", "SUBMITTED", "SETTLED", "FAILED"]);
export type TransferStatus = z.infer<typeof transferStatusEnum>;

export const transferRailEnum = z.enum(["BECS", "PAYTO"]);
export type TransferRail = z.infer<typeof transferRailEnum>;

const monetaryValueSchema = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === "number" ? value.toFixed(2) : value.trim()))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: "value must be a decimal string with up to 2 fractional digits",
  });

export const monetaryAmountSchema = z.object({
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, "currency must be a 3-letter ISO code"),
  value: monetaryValueSchema,
});
export type MonetaryAmount = z.infer<typeof monetaryAmountSchema>;

export const becsAccountSchema = z.object({
  accountName: z.string().trim().min(1).max(140),
  bsb: z
    .string()
    .regex(/^\d{6}$/u, "bsb must be 6 digits"),
  accountNumber: z
    .string()
    .regex(/^\d{5,9}$/u, "account number must be 5-9 digits"),
});
export type BecsAccount = z.infer<typeof becsAccountSchema>;

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(140),
  email: z.string().email().optional(),
  reference: z.string().trim().min(1).max(40),
});
export type Customer = z.infer<typeof customerSchema>;

export const createBecsDebitRequestSchema = z.object({
  requestId: z.string().trim().min(10, "requestId must be at least 10 characters"),
  orgId: z.string().trim().min(1),
  customer: customerSchema,
  account: becsAccountSchema,
  amount: monetaryAmountSchema,
  description: z.string().trim().min(1).max(140),
  debitDate: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type CreateBecsDebitRequest = z.infer<typeof createBecsDebitRequestSchema>;

export const cancelTransferRequestSchema = z.object({
  transferId: z.string().cuid("transferId must be a cuid"),
  requestId: z.string().trim().min(10),
  reason: z.string().trim().min(5).max(200).optional(),
});
export type CancelTransferRequest = z.infer<typeof cancelTransferRequestSchema>;

export const transferDtoSchema = z.object({
  id: z.string().cuid(),
  orgId: z.string(),
  requestId: z.string(),
  rail: transferRailEnum,
  amount: z.object({
    currency: z.string().length(3),
    value: z.string(),
  }),
  status: transferStatusEnum,
  externalId: z.string().nullable(),
  metadata: z.record(z.string(), z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TransferDto = z.infer<typeof transferDtoSchema>;

export const transferEventDtoSchema = z.object({
  id: z.string().cuid(),
  transferId: z.string().cuid(),
  requestId: z.string(),
  kind: z.string(),
  payload: z.unknown(),
  createdAt: z.date(),
});
export type TransferEventDto = z.infer<typeof transferEventDtoSchema>;
