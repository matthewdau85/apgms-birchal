import { z } from "zod";

const MONEY_REGEX = /^-?\d+(?:\.\d{1,})?$/;

export const cuidSchema = z.string().cuid();
export const uuidSchema = z.string().uuid();
export const idSchema = z.union([cuidSchema, uuidSchema]);

export const isoDateTimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid ISO date",
  });

export const moneyInputSchema = z.union([
  z.number(),
  z
    .string()
    .regex(MONEY_REGEX, { message: "Invalid monetary amount" }),
]);

export const moneyOutputSchema = z
  .string()
  .regex(MONEY_REGEX, { message: "Invalid monetary amount" });

export const paginationQuerySchema = z.object({
  cursor: z.string().optional().nullable(),
  take: z.coerce.number().int().min(1).max(200).default(20),
});

export const paginationMetaSchema = z.object({
  hasNextPage: z.boolean(),
  nextCursor: z.string().nullable(),
});

export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  statusCode: z.number().int().optional(),
});

export type Cuid = z.infer<typeof cuidSchema>;
export type Uuid = z.infer<typeof uuidSchema>;
export type Id = z.infer<typeof idSchema>;
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;
export type MoneyInput = z.infer<typeof moneyInputSchema>;
export type MoneyOutput = z.infer<typeof moneyOutputSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
