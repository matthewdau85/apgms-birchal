import { z } from "zod";

const dateTransform = z.union([z.string(), z.date()]).transform((value, ctx) => {
  const candidate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(candidate.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.invalid_date,
      message: "Invalid date",
    });
    return z.NEVER;
  }
  return candidate;
});

const amountTransform = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Number(value.toFixed(2));
    }

    if (typeof value === "string") {
      const cleaned = value.replace(/,/g, "").trim();
      if (cleaned.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.invalid_string, message: "Amount is required" });
        return z.NEVER;
      }

      const parsed = Number(cleaned);
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid amount" });
        return z.NEVER;
      }

      return Number(parsed.toFixed(2));
    }

    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unsupported amount" });
    return z.NEVER;
  });

export const orgSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.date(),
});

export const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  createdAt: z.date(),
  orgId: z.string().min(1),
});

export const authCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const bankLineSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  date: z.date(),
  amount: z.number(),
  payee: z.string().min(1),
  desc: z.string().min(1),
  createdAt: z.date(),
});

export const bankLineCreateSchema = z.object({
  orgId: z.string().trim().min(1, "Organisation is required"),
  date: dateTransform,
  amount: amountTransform,
  payee: z.string().trim().min(1, "Payee is required"),
  desc: z.string().trim().min(1, "Description is required"),
});

export const paginationSchema = z.object({
  take: z.coerce.number().int().min(1).max(200).default(20),
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type BankLineCreateInput = z.input<typeof bankLineCreateSchema>;
export type BankLineCreate = z.infer<typeof bankLineCreateSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
