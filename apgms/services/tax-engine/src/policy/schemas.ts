import { z } from 'zod';

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Invalid ISO date',
  });

export const paygwPeriodSchema = z.enum(['weekly', 'fortnightly', 'monthly']);

export const paygwThresholdSchema = z.object({
  minimum: z.number(),
  maximum: z.number().nullable(),
  baseWithholding: z.number(),
  marginalRate: z.number(),
});

export const paygwRoundingRuleSchema = z.object({
  id: z.string(),
  method: z.enum(['NEAREST', 'UP', 'DOWN']),
  precision: z.number().int(),
  half: z.enum(['UP', 'DOWN', 'EVEN']).optional(),
  description: z.string(),
});

export const paygwScaleSchema = z.object({
  id: z.string(),
  period: paygwPeriodSchema,
  thresholdsFile: z.string(),
  roundingRuleId: z.string(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable(),
  notes: z.string(),
});

export const paygwPolicySchema = z.object({
  version: z.string(),
  published: isoDate,
  source: z.string(),
  roundingRules: z.array(paygwRoundingRuleSchema).nonempty(),
  scales: z.array(paygwScaleSchema).nonempty(),
});

export const gstRateSchema = z.object({
  id: z.string(),
  rate: z.number(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable(),
  adjustmentType: z.enum(['standard', 'luxury', 'import']),
  notes: z.string(),
});

export const gstMetadataSchema = z.object({
  version: z.string(),
  published: isoDate,
  source: z.string(),
  rates: z.array(gstRateSchema).nonempty(),
});

export const basLabelSchema = z.object({
  label: z.string(),
  description: z.string(),
  internalField: z.string(),
  category: z.enum(['GST', 'PAYGW', 'PAYGI', 'Fuel']),
  notes: z.string(),
});

export const basLabelMappingSchema = z.object({
  version: z.string(),
  published: isoDate,
  source: z.string(),
  mappings: z.array(basLabelSchema).nonempty(),
});

export type PaygwPolicySchema = z.infer<typeof paygwPolicySchema>;
export type PaygwThresholdSchema = z.infer<typeof paygwThresholdSchema>;
export type GstMetadataSchema = z.infer<typeof gstMetadataSchema>;
export type BasLabelMappingSchema = z.infer<typeof basLabelMappingSchema>;
