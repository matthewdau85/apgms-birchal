import { z } from "zod";

export const payToStatusSchema = z.enum(["PENDING", "ACTIVE", "REVOKED"]);

export const createConsentRequestSchema = z.object({
  orgId: z.string().min(1),
  bank: z.string().min(1),
  accountRef: z.string().min(1),
});

export const createConsentResponseSchema = z.object({
  id: z.string(),
  status: payToStatusSchema,
  next: z.object({
    type: z.literal("redirect"),
    url: z.string().url(),
    expiresAt: z.string(),
  }),
});

export const getConsentResponseSchema = z.object({
  id: z.string(),
  status: payToStatusSchema,
});

export const createMandateRequestSchema = z.object({
  orgId: z.string().min(1),
  bankConnectionId: z.string().min(1),
  reference: z.string().min(1),
  amountLimitCents: z.number().int().positive(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});

export const createMandateResponseSchema = z.object({
  id: z.string(),
  status: payToStatusSchema,
  nextEvent: z.object({
    endpoint: z.string(),
    body: z.record(z.any()),
  }),
});

export const getMandateResponseSchema = z.object({
  id: z.string(),
  status: payToStatusSchema,
  latestEvent: z
    .object({
      kind: z.string(),
      occurredAt: z.string(),
      payload: z.record(z.any()),
    })
    .nullable(),
});

const webhookHeadersSchema = z.object({
  "x-signature": z.string().min(1),
  "x-nonce": z.string().min(1),
  "x-timestamp": z.string().min(1),
});

export const consentWebhookSchema = z.object({
  type: z.literal("consent.updated"),
  orgId: z.string().min(1),
  bankConnectionId: z.string().min(1),
  status: payToStatusSchema,
  occurredAt: z.string(),
});

export const mandateWebhookSchema = z.object({
  type: z.literal("mandate.updated"),
  orgId: z.string().min(1),
  mandateId: z.string().min(1),
  bankConnectionId: z.string().min(1),
  reference: z.string().min(1),
  status: payToStatusSchema,
  amountLimitCents: z.number().int().positive(),
  occurredAt: z.string(),
});

export const paymentWebhookSchema = z.object({
  type: z.literal("payment.processed"),
  orgId: z.string().min(1),
  mandateId: z.string().min(1),
  paymentId: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  status: z.enum(["PENDING", "SETTLED", "FAILED"]),
  occurredAt: z.string(),
});

export const webhookEnvelopeSchema = z.object({
  headers: webhookHeadersSchema,
});

export type CreateConsentRequest = z.infer<typeof createConsentRequestSchema>;
export type CreateConsentResponse = z.infer<typeof createConsentResponseSchema>;
export type GetConsentResponse = z.infer<typeof getConsentResponseSchema>;
export type CreateMandateRequest = z.infer<typeof createMandateRequestSchema>;
export type CreateMandateResponse = z.infer<typeof createMandateResponseSchema>;
export type GetMandateResponse = z.infer<typeof getMandateResponseSchema>;
export type ConsentWebhookPayload = z.infer<typeof consentWebhookSchema>;
export type MandateWebhookPayload = z.infer<typeof mandateWebhookSchema>;
export type PaymentWebhookPayload = z.infer<typeof paymentWebhookSchema>;
