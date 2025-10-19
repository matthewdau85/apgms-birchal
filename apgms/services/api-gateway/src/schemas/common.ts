import { z } from "zod";

export const emailSchema = z.string().email();
export const cuidSchema = z.string().cuid();
export const orgIdSchema = cuidSchema;
export const isoDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid ISO date");
export const moneyCentsSchema = z
  .number({ invalid_type_error: "amount must be a number" })
  .int();
export const moneyCentsCoerceSchema = z
  .coerce.number({ invalid_type_error: "amount must be a number" })
  .int();
export const positiveIntSchema = z.coerce.number().int().positive();
