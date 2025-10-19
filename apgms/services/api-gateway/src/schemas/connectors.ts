import { z } from "zod";

export const OAuthStartSchema = z.object({
  orgId: z.string().min(1, "orgId required"),
  redirectUri: z.string().url().optional(),
});

export const OAuthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(8),
  orgId: z.string().min(1),
  redirectUri: z.string().url().optional(),
  scope: z.string().optional(),
  error: z.string().optional(),
});

export const NormalizedInvoiceSchema = z.object({
  provider: z.string(),
  orgId: z.string(),
  externalId: z.string(),
  number: z.string(),
  status: z.string(),
  total: z.number(),
  currency: z.string().length(3),
  issuedAt: z.date(),
  dueAt: z.date().optional(),
  customerName: z.string(),
});

export const NormalizedPaymentSchema = z.object({
  provider: z.string(),
  orgId: z.string(),
  externalId: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  occurredAt: z.date(),
  counterpartyName: z.string(),
  description: z.string().optional(),
  type: z.string(),
});

export const NormalizedEmployeeSchema = z.object({
  provider: z.string(),
  orgId: z.string(),
  externalId: z.string(),
  fullName: z.string(),
  email: z.string().email().optional(),
  status: z.string(),
  hiredAt: z.date().optional(),
});

export const WebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  occurredAt: z.coerce.date(),
  payload: z.unknown().optional(),
});

export const WebhookPayloadSchema = z.object({
  orgId: z.string(),
  connectionId: z.string().optional(),
  nonce: z.string(),
  timestamp: z.coerce.date(),
  events: z.array(WebhookEventSchema).default([]),
});

export type NormalizedInvoice = z.infer<typeof NormalizedInvoiceSchema>;
export type NormalizedPayment = z.infer<typeof NormalizedPaymentSchema>;
export type NormalizedEmployee = z.infer<typeof NormalizedEmployeeSchema>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
