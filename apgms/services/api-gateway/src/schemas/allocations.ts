import { z } from "zod";

export const allocationRuleSchema = z.object({
  bucket: z.string().min(1),
  weight: z.number().nonnegative(),
  minCents: z.number().int().nonnegative().optional(),
  memo: z.string().optional(),
});

export const rulesetSchema = z.object({
  strategy: z.string().optional(),
  allocations: z.array(allocationRuleSchema).min(1),
  gates: z.array(z.string().min(1)).optional(),
  noRemittanceBucket: z.string().min(1).optional(),
});

export const gateStateSchema = z.object({
  id: z.string().min(1),
  state: z.string().min(1),
});

export const accountStatesSchema = z.object({
  gates: z.array(gateStateSchema).optional(),
});

export const allocationResultSchema = z.object({
  bucket: z.string(),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().min(1),
  memo: z.string().nullable().optional(),
});

export const allocationExplainSchema = z.object({
  strategy: z.string(),
  remainderCents: z.number().int(),
  gateStates: z.record(z.string(), z.string()),
  noRemittance: z.boolean(),
});

export const previewRequestSchema = z.object({
  bankLineId: z.string().min(1),
  ruleset: rulesetSchema,
  accountStates: accountStatesSchema.optional(),
});

export const previewResponseSchema = z.object({
  allocations: z.array(allocationResultSchema),
  policyHash: z.string(),
  explain: allocationExplainSchema,
});

export const applyRequestSchema = previewRequestSchema.extend({
  memo: z.string().optional(),
  keyAlias: z.string().min(1).optional(),
});

export const ledgerEntrySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  bankLineId: z.string(),
  bucket: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  memo: z.string().nullable(),
  createdAt: z.string(),
});

export const rptSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  bankLineId: z.string(),
  policyHash: z.string(),
  allocations: z.array(allocationResultSchema),
  prevHash: z.string(),
  sig: z.string(),
  timestamp: z.string(),
  keyAlias: z.string(),
  keyId: z.string(),
});

export const auditSummarySchema = z.object({
  id: z.string(),
  kind: z.string(),
  hash: z.string(),
});

export const applyResponseSchema = previewResponseSchema.extend({
  ledgerEntries: z.array(ledgerEntrySchema),
  rpt: rptSchema,
  audit: auditSummarySchema,
});
