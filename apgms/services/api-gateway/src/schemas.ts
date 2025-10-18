import { z } from "zod";

export const paginationQuerySchema = z.object({
  take: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return 20;
      }

      const coerced = Number(value);
      if (!Number.isFinite(coerced)) {
        return 20;
      }
      return Math.min(Math.max(Math.trunc(coerced), 1), 200);
    }),
});

export const bankLineCreateSchema = z.object({
  date: z.coerce.date(),
  amount: z.coerce.number(),
  payee: z.string().min(1),
  desc: z.string().min(1),
});

export const bankLineResponseSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string(),
  amount: z.number(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string(),
});

export const bankLineListResponseSchema = z.object({
  lines: z.array(bankLineResponseSchema),
});

export const userResponseSchema = z.object({
  email: z.string().email(),
  orgId: z.string(),
  createdAt: z.string(),
});

export const userListResponseSchema = z.object({
  users: z.array(userResponseSchema),
});

export const webhookPayloadSchema = z.object({
  id: z.string(),
  type: z.string(),
  occurredAt: z.coerce.date(),
  data: z.unknown(),
});

export const webhookAcceptedResponseSchema = z.object({
  received: z.boolean(),
  auditId: z.string(),
});

export const auditReportSchema = z.object({
  id: z.string(),
  valid: z.boolean(),
  entry: z.object({
    id: z.string(),
    prevHash: z.string(),
    hash: z.string(),
    timestamp: z.string(),
    payload: z.unknown(),
  }),
});
