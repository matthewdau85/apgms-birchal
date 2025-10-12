import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  basLabelMappingSchema,
  gstMetadataSchema,
  paygwPolicySchema,
  paygwThresholdSchema,
} from './schemas.js';
import type {
  BasLabelMapping,
  GstMetadata,
  PaygwPolicy,
  PaygwRoundingRule,
  PaygwScale,
  PaygwThreshold,
} from './types.js';

export interface PaygwScaleDataset extends PaygwScale {
  thresholds: PaygwThreshold[];
  roundingRule: PaygwRoundingRule;
  effectiveFromDate: Date;
  effectiveToDate: Date | null;
}

export interface PolicyDataset {
  paygw: {
    policy: PaygwPolicy;
    scales: PaygwScaleDataset[];
  };
  gst: GstMetadata;
  bas: BasLabelMapping;
}

async function loadJson<T>(filePath: string, schema: { parse: (value: unknown) => T }): Promise<T> {
  const file = await readFile(filePath, 'utf-8');
  const json = JSON.parse(file);
  return schema.parse(json);
}

function parseThresholdCsv(content: string): PaygwThreshold[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const [header, ...rows] = lines;
  const columns = header.split(',').map((part) => part.trim());
  const expected = ['minimum', 'maximum', 'baseWithholding', 'marginalRate'];
  if (!expected.every((name, index) => columns[index] === name)) {
    throw new Error(`Unexpected PAYGW CSV header: ${header}`);
  }

  return rows.map((row) => {
    const [minimum, maximum, baseWithholding, marginalRate] = row.split(',').map((part) => part.trim());
    return paygwThresholdSchema.parse({
      minimum: Number.parseFloat(minimum),
      maximum: maximum ? Number.parseFloat(maximum) : null,
      baseWithholding: Number.parseFloat(baseWithholding),
      marginalRate: Number.parseFloat(marginalRate),
    });
  });
}

async function loadPaygw(root: string): Promise<PolicyDataset['paygw']> {
  const policyPath = path.join(root, 'paygw', 'policy.json');
  const policy = await loadJson(policyPath, paygwPolicySchema);

  const roundingRuleLookup = new Map(policy.roundingRules.map((rule) => [rule.id, rule]));

  const scales: PaygwScaleDataset[] = [];
  for (const scale of policy.scales) {
    const csvPath = path.join(root, 'paygw', scale.thresholdsFile);
    const csvContent = await readFile(csvPath, 'utf-8');
    const thresholds = parseThresholdCsv(csvContent);
    const roundingRule = roundingRuleLookup.get(scale.roundingRuleId);
    if (!roundingRule) {
      throw new Error(`Missing rounding rule ${scale.roundingRuleId} for scale ${scale.id}`);
    }
    scales.push({
      ...scale,
      thresholds,
      roundingRule,
      effectiveFromDate: new Date(scale.effectiveFrom),
      effectiveToDate: scale.effectiveTo ? new Date(scale.effectiveTo) : null,
    });
  }

  return { policy, scales };
}

export async function loadPolicyDataset(root: string): Promise<PolicyDataset> {
  const [paygw, gst, bas] = await Promise.all([
    loadPaygw(root),
    loadJson(path.join(root, 'gst', 'rates.json'), gstMetadataSchema),
    loadJson(path.join(root, 'bas', 'labels.json'), basLabelMappingSchema),
  ]);

  return { paygw, gst, bas };
}
