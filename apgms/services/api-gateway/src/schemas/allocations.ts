import { z } from "zod";

import { allocationSchema, rptTokenSchema } from "./rpt.js";

const bankLineSchema = z.object({
  id: z.string().optional(),
  amountCents: z.number().int().nonnegative(),
  currency: z.literal("AUD"),
});

const policyRuleSchema = z.object({
  bucket: z.string().min(1),
  weight: z.number().int().positive(),
});

const policyRulesetSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  rules: z.array(policyRuleSchema).min(1),
});

const accountStateSchema = z.object({
  bucket: z.string().min(1),
  gate: z.enum(["OPEN", "CLOSED"]),
});

export const allocationsPreviewRequestSchema = z.object({
  bankLine: bankLineSchema,
  ruleset: policyRulesetSchema,
  accountStates: z.array(accountStateSchema).default([]),
});

export const allocationsPreviewResponseSchema = z.object({
  allocations: z.array(allocationSchema),
  policyHash: z.string().min(1),
  explain: z.string().min(1),
});

export const allocationsApplyRequestSchema = allocationsPreviewRequestSchema.extend({
  orgId: z.string().min(1),
  bankLineId: z.string().min(1),
  prevRptId: z.string().min(1).optional(),
});

export const ledgerEntrySchema = z.object({
  ledgerEntryId: z.string().min(1),
  orgId: z.string().min(1),
  bankLineId: z.string().min(1),
  bucket: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  currency: z.literal("AUD"),
  createdAt: z.string().min(1),
});

export const auditBlobSchema = z.object({
  auditId: z.string().min(1),
  createdAt: z.string().min(1),
  type: z.literal("RPT"),
  rptId: z.string().min(1),
  rptDigest: z.string().min(1),
  payload: rptTokenSchema,
});

export const allocationsApplyResponseSchema = z.object({
  allocations: z.array(allocationSchema),
  policyHash: z.string().min(1),
  explain: z.string().min(1),
  rpt: rptTokenSchema,
  ledgerEntries: z.array(ledgerEntrySchema),
  auditBlob: auditBlobSchema,
});

export type AllocationsPreviewRequest = z.infer<typeof allocationsPreviewRequestSchema>;
export type AllocationsPreviewResponse = z.infer<typeof allocationsPreviewResponseSchema>;
export type AllocationsApplyRequest = z.infer<typeof allocationsApplyRequestSchema>;
export type AllocationsApplyResponse = z.infer<typeof allocationsApplyResponseSchema>;
