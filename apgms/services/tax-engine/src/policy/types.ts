import { z } from 'zod';
import {
  basLabelMappingSchema,
  basLabelSchema,
  gstMetadataSchema,
  gstRateSchema,
  paygwPeriodSchema,
  paygwPolicySchema,
  paygwRoundingRuleSchema,
  paygwScaleSchema,
  paygwThresholdSchema,
} from './schemas.js';

export type PaygwPeriod = z.infer<typeof paygwPeriodSchema>;
export type PaygwThreshold = z.infer<typeof paygwThresholdSchema>;
export type PaygwRoundingRule = z.infer<typeof paygwRoundingRuleSchema>;
export type PaygwScale = z.infer<typeof paygwScaleSchema>;
export type PaygwPolicy = z.infer<typeof paygwPolicySchema>;
export type GstRate = z.infer<typeof gstRateSchema>;
export type GstMetadata = z.infer<typeof gstMetadataSchema>;
export type BasLabel = z.infer<typeof basLabelSchema>;
export type BasLabelMapping = z.infer<typeof basLabelMappingSchema>;
